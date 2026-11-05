import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { buildMenu } from './menu.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const prefix = process.env.PREFIX || '.';
const startedAt = Date.now();
const pairToken = randomBytes(24).toString('hex');
let connected = false;
let botSocket = null;
let pairingInProgress = false;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/pair/' + pairToken, (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Referrer-Policy', 'no-referrer');
  res.type('html').send(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LORD ULTRA Pairing</title></head>
<body style="font-family:Arial,sans-serif;max-width:460px;margin:40px auto;padding:20px;background:#101018;color:#fff">
<h2>LORD ULTRA — Number Pairing</h2>
<p>Enter your WhatsApp number with country code. Example: India = 91 followed by your 10-digit number. Do not add + or spaces.</p>
<form id="pairForm"><input id="phone" inputmode="numeric" autocomplete="tel" placeholder="919876543210" required pattern="[0-9]{8,15}" style="box-sizing:border-box;width:100%;padding:14px;font-size:18px">
<button style="margin-top:14px;padding:13px 20px;font-size:16px">Get Pairing Code</button></form>
<h2 id="code" style="letter-spacing:5px"></h2><p id="status"></p>
<p style="color:#bbb;font-size:13px">Keep the pairing code private. Only enter it in your own WhatsApp app.</p>
<script>
document.getElementById('pairForm').addEventListener('submit',async e=>{
 e.preventDefault();const status=document.getElementById('status');const code=document.getElementById('code');
 status.textContent='Requesting code…';code.textContent='';
 try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');code.textContent=d.code;status.textContent='On WhatsApp: Linked Devices → Link a Device → Link with phone number instead.'}
 catch(err){status.textContent=err.message}
});
</script></body></html>`);
});

app.post('/pair/' + pairToken, async (req, res) => {
  const phone = String(req.body?.phone || '').replace(/[^0-9]/g, '');
  if (!/^\d{8,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number with country code, digits only.' });
  if (connected || botSocket?.authState?.creds?.registered) return res.status(409).json({ error: 'WhatsApp is already linked. Remove the saved session only if you want to pair again.' });
  if (!botSocket) return res.status(503).json({ error: 'Bot is still starting. Wait a few seconds and try again.' });
  if (pairingInProgress) return res.status(429).json({ error: 'A pairing code request is already running. Wait and try again.' });
  pairingInProgress = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const code = await botSocket.requestPairingCode(phone);
    res.set('Cache-Control', 'no-store');
    res.json({ code });
    console.log('A WhatsApp pairing code was generated. Check the private pairing page.');
  } catch (error) {
    console.error('Pairing code request failed:', error);
    res.status(500).json({ error: 'Could not generate a pairing code. Check Railway logs and try again.' });
  } finally {
    pairingInProgress = false;
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const page = (domain ? 'https://' + domain : '') + '/pair/' + pairToken;
  console.log('LORD ULTRA NUMBER PAIRING PAGE: ' + page);
  if (!domain) console.log('Generate a Railway public domain for this service to open the pairing page.');
});

const formatUptime = () => {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['LORD ULTRA', 'Chrome', '1.0.0'],
  });
  botSocket = sock;

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      connected = true;
      console.log('LORD ULTRA connected successfully.');
    }
    if (connection === 'close') {
      connected = false;
      botSocket = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startBot().catch(console.error);
      else console.log('Logged out. Remove the session folder and pair again.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const body = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || msg.message.imageMessage?.caption
        || '';
      if (!body.startsWith(prefix)) continue;
      const [command] = body.slice(prefix.length).trim().split(/\\s+/);
      if (command?.toLowerCase() === 'ping') {
        await sock.sendMessage(jid, { text: 'Pong! LORD ULTRA is online ⚡' }, { quoted: msg });
      } else if (command?.toLowerCase() === 'menu') {
        await sock.sendMessage(jid, { text: buildMenu({ prefix, owner: process.env.OWNER || 'Not set', mode: process.env.MODE || 'Public', version: '1.0.0', uptime: formatUptime(), speed: 'live' }) }, { quoted: msg });
      }
    }
  });
}

startBot().catch(err => {
  console.error('Failed to start LORD ULTRA:', err);
  process.exitCode = 1;
});
