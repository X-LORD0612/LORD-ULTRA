import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { buildMenu } from './menu.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const prefix = process.env.PREFIX || '.';
const startedAt = Date.now();
const loginToken = randomBytes(24).toString('hex');
let latestQr = null;
let connected = false;
let botSocket = null;
let isRegistered = false;
let pairingInProgress = false;

const app = express();
app.use(express.json());

app.get('/login/' + loginToken, (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Referrer-Policy', 'no-referrer');
  res.type('html').send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080d12"><title>LORD ULTRA Login</title>
<style>
:root{color-scheme:dark;--bg:#080d12;--surface:#101820;--raised:#141f28;--border:#263640;--text:#eef5f6;--muted:#9aabb2;--accent:#43e0a0;--accentdark:#112d25;--danger:#ff817e}
*{box-sizing:border-box}body{min-height:100vh;margin:0;background:radial-gradient(ellipse at 50% -20%,#15352e 0,transparent 42%),var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.top{min-height:68px;padding:0 6vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #263640}.brand{font-weight:800;letter-spacing:.12em}.brand span{color:var(--accent)}.note,.muted{color:var(--muted)}
main{width:min(100% - 32px,560px);margin:8vh auto 50px}.eyebrow{color:var(--accent);font-size:.75rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(1.8rem,6vw,2.4rem);line-height:1.15;margin:0}.intro{color:var(--muted);margin:12px 0 24px}
.card{overflow:hidden;border:1px solid var(--border);border-radius:18px;background:linear-gradient(160deg,#141f28,#0d141b);box-shadow:0 24px 70px #0006}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px;background:#0003;border-bottom:1px solid var(--border)}
.tab{min-height:48px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--muted);font:inherit;font-weight:700;cursor:pointer}
.tab[aria-selected=true]{border-color:#43e0a04d;background:var(--accentdark);color:var(--accent)}
.panel{padding:clamp(22px,5vw,32px)}[hidden]{display:none!important}h2{font-size:1.2rem;margin:0 0 6px}.copy{color:var(--muted);font-size:.94rem;margin:0 0 22px}
label{display:block;margin-bottom:8px;font-weight:650}.field{display:flex;min-height:54px;border:1px solid var(--border);border-radius:12px;background:#0b1117;overflow:hidden}
input{width:100%;min-width:0;padding:0 15px;border:0;outline:0;background:transparent;color:var(--text);font:inherit}.primary,.secondary{min-height:50px;border-radius:12px;font:inherit;font-weight:700;cursor:pointer}.primary{width:100%;border:0;background:var(--accent);color:#062017}.primary:disabled{opacity:.6}.secondary{padding:0 18px;border:1px solid var(--border);background:var(--raised);color:var(--text)}
.hint,.foot{color:var(--muted);font-size:.82rem}.result{min-height:48px;margin-top:16px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;color:var(--muted);text-align:center;overflow-wrap:anywhere}.result[data-state=error]{color:var(--danger)}.result[data-state=success]{color:var(--accent)}
.code{display:block;font:800 1.5rem ui-monospace,monospace;letter-spacing:.15em;color:var(--text);margin-top:5px}
.qrstage{display:grid;min-height:270px;place-items:center;margin:18px 0;padding:18px;border:1px dashed #365047;border-radius:14px;background:#0b1117}
#qrimg{width:min(100%,260px);aspect-ratio:1;background:white;border-radius:8px;object-fit:contain}.foot{text-align:center;margin-top:18px}
</style></head><body><header class="top"><div class="brand">LORD<span>•</span>ULTRA</div><div class="note">WhatsApp connection</div></header>
<main><div class="eyebrow">Connect a device</div><h1>Choose a login method</h1><p class="intro">Connect LORD ULTRA using a QR code or a phone-number pairing code.</p>
<section class="card"><div class="tabs" role="tablist"><button class="tab" id="pairtab" role="tab" aria-selected="true" type="button">Pairing code</button><button class="tab" id="qrtab" role="tab" aria-selected="false" type="button">QR code</button></div>
<section class="panel" id="pairpanel"><h2>Connect with your phone number</h2><p class="copy">Enter your number with its country calling code.</p><form id="pairform"><label for="phone">Phone number</label><div class="field"><input id="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="919876543210" pattern="[0-9]{8,15}" required></div><p class="hint">India: 91 followed by your 10-digit number. Digits only.</p><button class="primary" id="pairbtn">Get pairing code</button></form><div class="result" id="pairresult" aria-live="polite">Your pairing code will appear here.</div></section>
<section class="panel" id="qrpanel" hidden><h2>Connect by scanning QR</h2><p class="copy">WhatsApp → Linked Devices → Link a Device.</p><div class="qrstage"><div id="qrplaceholder" class="muted">Waiting for WhatsApp QR…</div><img id="qrimg" alt="WhatsApp login QR code" hidden></div><button class="primary" id="refreshqr" type="button">Refresh QR</button><div class="result" id="qrresult" aria-live="polite">Waiting for QR code…</div></section></section>
<p class="foot">Keep your pairing code and login page private. Only link your own WhatsApp account.</p></main>
<script>
const pairTab=document.getElementById('pairtab'),qrTab=document.getElementById('qrtab'),pairPanel=document.getElementById('pairpanel'),qrPanel=document.getElementById('qrpanel');
function select(mode){const p=mode==='pair';pairPanel.hidden=!p;qrPanel.hidden=p;pairTab.setAttribute('aria-selected',String(p));qrTab.setAttribute('aria-selected',String(!p));if(!p)refreshQR()}
pairTab.onclick=()=>select('pair');qrTab.onclick=()=>select('qr');
const pairForm=document.getElementById('pairform'),pairBtn=document.getElementById('pairbtn'),pairResult=document.getElementById('pairresult');
pairForm.addEventListener('submit',async e=>{e.preventDefault();pairBtn.disabled=true;pairBtn.textContent='Requesting code…';pairResult.dataset.state='';pairResult.textContent='Contacting WhatsApp…';try{const r=await fetch(location.pathname+'/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not generate code');pairResult.dataset.state='success';pairResult.replaceChildren(document.createTextNode('Your pairing code'),document.createElement('br'));const c=document.createElement('span');c.className='code';c.textContent=d.code;pairResult.append(c);const hint=document.createElement('p');hint.textContent='WhatsApp → Linked Devices → Link a Device → Link with phone number instead.';pairResult.append(hint)}catch(err){pairResult.dataset.state='error';pairResult.textContent=err.message}finally{pairBtn.disabled=false;pairBtn.textContent='Get pairing code'}});
const qrImg=document.getElementById('qrimg'),qrPlaceholder=document.getElementById('qrplaceholder'),qrResult=document.getElementById('qrresult');
async function refreshQR(){qrResult.textContent='Checking for a fresh QR code…';try{const r=await fetch(location.pathname+'/qr?refresh='+Date.now(),{cache:'no-store'});const d=await r.json();if(d.qr){qrImg.src=d.qr;qrImg.hidden=false;qrPlaceholder.hidden=true;qrResult.dataset.state='success';qrResult.textContent='Scan with WhatsApp → Linked Devices → Link a Device.'}else{qrImg.hidden=true;qrPlaceholder.hidden=false;qrPlaceholder.textContent=d.status||'Waiting for WhatsApp QR…';qrResult.dataset.state='';qrResult.textContent=d.status||'Waiting for QR code…'}}catch{qrResult.dataset.state='error';qrResult.textContent='Could not load QR. Try again.'}}
qrImg.addEventListener('error',()=>{qrImg.hidden=true;qrPlaceholder.hidden=false;qrPlaceholder.textContent='QR image unavailable. Refresh to try again.';qrResult.dataset.state='error'});
document.getElementById('refreshqr').onclick=refreshQR;
</script></body></html>`);
});

app.get('/login/' + loginToken + '/qr', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (connected) return res.json({ status: 'Already connected.' });
  if (!latestQr) return res.json({ status: 'Waiting for QR…' });
  try { res.json({ qr: await QRCode.toDataURL(latestQr, { width: 420, margin: 2 }) }); }
  catch { res.status(500).json({ status: 'Could not render QR.' }); }
});

app.post('/login/' + loginToken + '/pair', async (req, res) => {
  const phone = String(req.body?.phone || '').replace(/[^0-9]/g, '');
  if (!/^\d{8,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid number with country code, digits only.' });
  if (connected || isRegistered) return res.status(409).json({ error: 'WhatsApp is already linked.' });
  if (!botSocket) return res.status(503).json({ error: 'Bot is still starting. Try again shortly.' });
  if (pairingInProgress) return res.status(429).json({ error: 'A pairing request is already running. Wait and retry.' });
  pairingInProgress = true;
  try {
    const code = await botSocket.requestPairingCode(phone);
    res.set('Cache-Control', 'no-store');
    res.json({ code });
  } catch (error) {
    console.error('Pairing code request failed:', error);
    res.status(500).json({ error: 'Could not generate code. Check Railway logs and retry.' });
  } finally { pairingInProgress = false; }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const page = (domain ? 'https://' + domain : '') + '/login/' + loginToken;
  console.log('LORD ULTRA LOGIN PAGE: ' + page);
  if (!domain) console.log('Generate a Railway public domain for this service.');
});

const formatUptime = () => {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  isRegistered = Boolean(state.creds.registered);
  const sock = makeWASocket({ auth: state, logger, printQRInTerminal: false, browser: ['LORD ULTRA', 'Chrome', '1.0.0'] });
  botSocket = sock;
  sock.ev.on('creds.update', async () => { await saveCreds(); isRegistered = Boolean(state.creds.registered); });
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) { latestQr = qr; connected = false; }
    if (connection === 'open') { connected = true; latestQr = null; isRegistered = true; console.log('LORD ULTRA connected successfully.'); }
    if (connection === 'close') {
      connected = false; latestQr = null; botSocket = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startBot().catch(console.error);
      else console.log('Logged out. Remove the session folder only if you intend to link again.');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
      if (!body.startsWith(prefix)) continue;
      const [command] = body.slice(prefix.length).trim().split(/\s+/);
      if (command?.toLowerCase() === 'ping') await sock.sendMessage(jid, { text: 'Pong! LORD ULTRA is online ⚡' }, { quoted: msg });
      else if (command?.toLowerCase() === 'menu') await sock.sendMessage(jid, { text: buildMenu({ prefix, owner: process.env.OWNER || 'Not set', mode: process.env.MODE || 'Public', version: '1.0.0', uptime: formatUptime(), speed: 'live' }) }, { quoted: msg });
    }
  });
}
startBot().catch(err => { console.error('Failed to start LORD ULTRA:', err); process.exitCode = 1; });
