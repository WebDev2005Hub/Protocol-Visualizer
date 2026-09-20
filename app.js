const state = { mode: 'browse', steps: [], index: 0, playing: false, timer: null };
const $ = (s) => document.querySelector(s);
const protocolData = {
  browse(host) { return { title: `Browsing ${host}`, chips: ['DNS', 'HTTP/1.1'], steps: [
    ['DNS', 'out', `Standard query  A  <mark>${host}</mark>`],
    ['DNS', 'in', `Standard query response  A  <mark>203.0.113.24</mark>\nTTL: 300 seconds`],
    ['HTTP/1.1', 'out', `GET <mark>/learn</mark> HTTP/1.1\nHost: ${host}\nUser-Agent: NetScope-Lab/1.0\nAccept: text/html`],
    ['HTTP/1.1', 'in', `HTTP/1.1 <mark>200 OK</mark>\nContent-Type: text/html; charset=utf-8\nContent-Length: 4821\nConnection: keep-alive`],
  ]}; },
  mail(to, subject) { const domain = to.split('@')[1] || 'netscope.edu'; return { title: `Sending mail to ${to}`, chips: ['DNS', 'SMTP'], steps: [
    ['DNS', 'out', `Standard query  MX  <mark>${domain}</mark>`],
    ['DNS', 'in', `MX response  preference 10\n<mark>mail.${domain}</mark>`],
    ['SMTP', 'in', `220 <mark>mail.${domain}</mark> ESMTP ready`],
    ['SMTP', 'out', `EHLO client.netscope.local`],
    ['SMTP', 'in', `250-mail.${domain}\n250 SIZE 10485760\n250 STARTTLS`],
    ['SMTP', 'out', `MAIL FROM:<student@netscope.local>\nRCPT TO:<mark>${to}</mark>`],
    ['SMTP', 'in', `250 2.1.0 Sender OK\n250 2.1.5 Recipient OK`],
    ['SMTP', 'out', `DATA\nSubject: <mark>${subject}</mark>\n... message body ...\n.`],
    ['SMTP', 'in', `250 2.0.0 Queued as <mark>NS-48291</mark>`],
    ['SMTP', 'out', `QUIT`],
  ]}; },
  stream(quality) { return { title: `Streaming video at ${quality}`, chips: ['DNS', 'HTTP/1.1'], steps: [
    ['DNS', 'out', `Standard query  A  <mark>media.netscope.edu</mark>`],
    ['DNS', 'in', `Standard query response  A  <mark>198.51.100.42</mark>`],
    ['HTTP/1.1', 'out', `GET <mark>/video/master.m3u8</mark> HTTP/1.1\nHost: media.netscope.edu`],
    ['HTTP/1.1', 'in', `HTTP/1.1 <mark>200 OK</mark>\nContent-Type: application/vnd.apple.mpegurl\n#EXT-X-STREAM-INF:RESOLUTION=${quality === '1080p' ? '1920x1080' : quality === '720p' ? '1280x720' : '854x480'}`],
    ['HTTP/1.1', 'out', `GET <mark>/video/${quality}/segment-001.ts</mark> HTTP/1.1\nRange: bytes=0-`],
    ['HTTP/1.1', 'in', `HTTP/1.1 <mark>206 Partial Content</mark>\nContent-Type: video/mp2t\nSegment duration: 4.0 seconds`],
    ['HTTP/1.1', 'out', `GET <mark>/video/${quality}/segment-002.ts</mark> HTTP/1.1`],
  ]}; }
};
function safe(text) { const div=document.createElement('div'); div.textContent=text; return div.innerHTML; }
async function requestFlow(endpoint, parameters, fallback) {
  const search = new URLSearchParams(parameters);
  try {
    const response = await fetch(`/api/${endpoint}?${search}`);
    if (!response.ok) throw new Error('API request failed');
    return await response.json();
  } catch (error) {
    // Allows index.html to remain viewable when opened directly without the server.
    return fallback();
  }
}
function addLog(message) { const now = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); const li=document.createElement('li'); li.innerHTML=`<time>${now}</time><span>${message}</span>`; $('#activityLog').prepend(li); }
function setMode(mode) { state.mode=mode; document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode)); document.querySelectorAll('.mode-form').forEach(f=>f.classList.toggle('active',f.dataset.form===mode)); }
function loadFlow(flow) { clearInterval(state.timer); state.playing=false; state.steps=flow.steps; state.index=0; $('#flowTitle').textContent=flow.title; $('#flowChips').innerHTML=flow.chips.map(c=>`<span>${c}</span>`).join(''); $('#stateText').textContent='READY'; $('#stateDot').parentElement.classList.remove('running'); render(); }
function render() { const visible=state.steps.slice(0,state.index); const timeline=$('#timeline'); if(!visible.length) timeline.innerHTML='<div class="empty-state"><div class="empty-network">◌</div><strong>Sequence ready</strong><p>Use the play button or step through each message.</p></div>'; else { timeline.innerHTML=visible.map((s,i)=>`<div class="message"><span class="message-number">${String(i+1).padStart(2,'0')}</span><div class="message-card ${s[1]}"><div class="message-meta"><span class="protocol-tag ${s[0]==='SMTP'?'smtp':s[0]==='HTTP/1.1'?'http':''}">${s[0]}</span><span class="direction">${s[1]==='out'?'CLIENT → SERVER':'SERVER → CLIENT'}</span></div><div class="payload">${s[2]}</div></div></div>`).join(''); timeline.scrollTop=timeline.scrollHeight; } $('#stepCurrent').textContent=state.index; $('#stepTotal').textContent=state.steps.length; $('#backButton').disabled=state.index===0; $('#nextButton').disabled=state.index===state.steps.length; $('#playButton').textContent=state.playing?'❚❚':'▶'; }
function next() { if(state.index<state.steps.length){state.index++;render();} if(state.index===state.steps.length){stop(true);} }
function previous(){if(state.index>0){state.index--;render();}}
function play(){if(!state.steps.length)return; if(state.playing){stop();return;} state.playing=true; $('#stateText').textContent='RUNNING'; $('#stateDot').parentElement.classList.add('running'); if(state.index===state.steps.length)state.index=0; render(); state.timer=setInterval(next,1350);}
function stop(done=false){clearInterval(state.timer);state.playing=false;$('#stateDot').parentElement.classList.remove('running');$('#stateText').textContent=done?'COMPLETE':'PAUSED';render();}
document.querySelectorAll('.mode-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('#browseForm').addEventListener('submit',async e=>{e.preventDefault();let raw=$('#urlInput').value.trim()||'https://www.netscope.edu/learn';let host;try{host=new URL(raw.startsWith('http')?raw:`https://${raw}`).hostname;}catch{host='www.netscope.edu'}addLog(`Browsing request started for <strong>${safe(host)}</strong>.`);loadFlow(await requestFlow('browse',{host},()=>protocolData.browse(host)));play();});
$('#mailForm').addEventListener('submit',async e=>{e.preventDefault();const to=$('#toInput').value.trim()||'student@netscope.edu';const subject=$('#subjectInput').value.trim()||'Application Layer Lab';addLog(`Email delivery started for <strong>${safe(to)}</strong>.`);loadFlow(await requestFlow('mail',{to,subject},()=>protocolData.mail(to,subject)));play();});
$('#streamButton').addEventListener('click',async()=>{const q=$('#qualityLabel').textContent;const active=$('#streamButton').dataset.active==='true'; if(active){$('#streamButton').dataset.active='false';$('#streamButton').innerHTML='<span>▶</span> Resume stream';stop();addLog('Stream playback paused.');return;}$('#streamButton').dataset.active='true';$('#streamButton').innerHTML='<span>❚❚</span> Pause stream';addLog(`Video stream started at <strong>${q}</strong>.`);loadFlow(await requestFlow('stream',{quality:q},()=>protocolData.stream(q)));play();});
$('#qualityInput').addEventListener('input',e=>{const vals=['480p','720p','1080p'];$('#qualityLabel').textContent=vals[e.target.value];});
$('#backButton').addEventListener('click',()=>{stop();previous()});$('#nextButton').addEventListener('click',()=>{stop();next()});$('#playButton').addEventListener('click',play);$('#replayButton').addEventListener('click',()=>{stop();state.index=0;render();play();});$('#clearLog').addEventListener('click',()=>{$('#activityLog').innerHTML='<li><time>NOW</time><span class="log-ready">Log cleared.</span></li>'});render();
