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
  res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LORD ULTRA Login</title></head>
<body style="font-family:Arial,sans-serif;max-width:480px;margin:30px auto;padding:20px;background:#101018;color:#fff">
<h2>LORD ULTRA Login</h2><p>Choose either login method.</p>
<div style="display:flex;gap:10px"><button onclick="show('qr')">QR Scan</button><button onclick="show('pair')">Phone Number Pairing</button></div>
<section id="qr" style="display:none"><h3>Scan QR</h3><p>Open WhatsApp → Linked Devices → Link a Device.</p><img id="qrimg" alt="WhatsApp QR will appear here" style="width:min(90vw,380px);background:white"><p id="qrstatus">Waiting for WhatsApp QR…</p></section>
<section id="pair" style="display:none"><h3>Pair with phone number</h3><p>Enter number with country code, digits only. India: 91 followed by your 10-digit number.</p><form id="pairForm"><input id="phone" inputmode="numeric" placeholder="919876543210" pattern="[0-9]{8,15}" required style="box-sizing:border-box;width:100%;padding:13px;font-size:18px"><button style="margin-top:12px;padding:12px">Get Pairing Code</button></form><h2 id="code" style="letter-spacing:5px"></h2><p id="status"></p><p style="color:#bbb;font-size:13px">Keep the code private.</p></section>
<script>
function show(id){document.getElementById('qr').style.display=id==='qr'?'block':'none';document.getElementById('pair').style.display=id==='pair'?'block':'none'}
async function refreshQR(){try{const r=await fetch(location.pathname+'/qr');if(r.ok){const d=await r.json();if(d.qr){document.getElementById('qrimg').src=d.qr;document.getElementById('qrstatus').textContent='Scan now with WhatsApp Linked Devices.'}else{document.getElementById('qrstatus').textContent=d.status||'Waiting for QR…'}}}catch(e){}}
setInterval(refreshQR,3000);refreshQR();
document.getElementById('pairForm').addEventListener('submit',async e=>{e.preventDefault();const s=document.getElementById('status'),c=document.getElementById('code');s.textContent='Requesting code…';c.textContent='';try{const r=await fetch(location.pathname+'/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');c.textContent=d.code;s.textContent='WhatsApp → Linked Devices → Link a Device → Link with phone number instead.'}catch(err){s.textContent=err.message}});
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
