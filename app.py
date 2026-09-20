"""Local backend for the Application Layer Dashboard.

Run: py app.py
Then open: http://localhost:8000
"""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent


def flow_for_browse(host: str) -> dict:
    return {
        "title": f"Browsing {host}",
        "chips": ["DNS", "HTTP/1.1"],
        "steps": [
            ["DNS", "out", f"Standard query  A  <mark>{host}</mark>"],
            ["DNS", "in", "Standard query response  A  <mark>203.0.113.24</mark>\nTTL: 300 seconds"],
            ["HTTP/1.1", "out", f"GET <mark>/learn</mark> HTTP/1.1\nHost: {host}\nUser-Agent: NetScope-Lab/1.0\nAccept: text/html"],
            ["HTTP/1.1", "in", "HTTP/1.1 <mark>200 OK</mark>\nContent-Type: text/html; charset=utf-8\nContent-Length: 4821\nConnection: keep-alive"],
        ],
    }


def flow_for_mail(recipient: str, subject: str) -> dict:
    domain = recipient.split("@")[-1] if "@" in recipient else "netscope.edu"
    return {
        "title": f"Sending mail to {recipient}",
        "chips": ["DNS", "SMTP"],
        "steps": [
            ["DNS", "out", f"Standard query  MX  <mark>{domain}</mark>"],
            ["DNS", "in", f"MX response  preference 10\n<mark>mail.{domain}</mark>"],
            ["SMTP", "in", f"220 <mark>mail.{domain}</mark> ESMTP ready"],
            ["SMTP", "out", "EHLO client.netscope.local"],
            ["SMTP", "in", f"250-mail.{domain}\n250 SIZE 10485760\n250 STARTTLS"],
            ["SMTP", "out", f"MAIL FROM:<student@netscope.local>\nRCPT TO:<mark>{recipient}</mark>"],
            ["SMTP", "in", "250 2.1.0 Sender OK\n250 2.1.5 Recipient OK"],
            ["SMTP", "out", f"DATA\nSubject: <mark>{subject}</mark>\n... message body ...\n."],
            ["SMTP", "in", "250 2.0.0 Queued as <mark>NS-48291</mark>"],
            ["SMTP", "out", "QUIT"],
        ],
    }


def flow_for_stream(quality: str) -> dict:
    resolution = {"480p": "854x480", "720p": "1280x720", "1080p": "1920x1080"}.get(quality, "1920x1080")
    return {
        "title": f"Streaming video at {quality}",
        "chips": ["DNS", "HTTP/1.1"],
        "steps": [
            ["DNS", "out", "Standard query  A  <mark>media.netscope.edu</mark>"],
            ["DNS", "in", "Standard query response  A  <mark>198.51.100.42</mark>"],
            ["HTTP/1.1", "out", "GET <mark>/video/master.m3u8</mark> HTTP/1.1\nHost: media.netscope.edu"],
            ["HTTP/1.1", "in", f"HTTP/1.1 <mark>200 OK</mark>\nContent-Type: application/vnd.apple.mpegurl\n#EXT-X-STREAM-INF:RESOLUTION={resolution}"],
            ["HTTP/1.1", "out", f"GET <mark>/video/{quality}/segment-001.ts</mark> HTTP/1.1\nRange: bytes=0-"],
            ["HTTP/1.1", "in", "HTTP/1.1 <mark>206 Partial Content</mark>\nContent-Type: video/mp2t\nSegment duration: 4.0 seconds"],
            ["HTTP/1.1", "out", f"GET <mark>/video/{quality}/segment-002.ts</mark> HTTP/1.1"],
        ],
    }


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serves the dashboard files and three simulation API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()

        query = parse_qs(parsed.query)
        if parsed.path == "/api/browse":
            payload = flow_for_browse(query.get("host", ["www.netscope.edu"])[0])
        elif parsed.path == "/api/mail":
            payload = flow_for_mail(query.get("to", ["student@netscope.edu"])[0], query.get("subject", ["Application Layer Lab"])[0])
        elif parsed.path == "/api/stream":
            payload = flow_for_stream(query.get("quality", ["1080p"])[0])
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return

        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), DashboardHandler)
    print("Dashboard running at http://localhost:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard server stopped.")
    finally:
        server.server_close()
