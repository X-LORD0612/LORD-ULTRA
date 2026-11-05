import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { buildMenu } from './menu.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const prefix = process.env.PREFIX || '.';
const startedAt = Date.now();
const qrToken = randomBytes(24).toString('hex');
let latestQr = null;
let connected = false;

const app = express();
app.get('/qr/' + qrToken, async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Referrer-Policy', 'no-referrer');
  if (connected) return res.status(200).send('<h2>LORD ULTRA is connected to WhatsApp.</h2>');
  if (!latestQr) return res.status(503).send('<h2>No active QR. Check Railway logs and refresh.</h2>');
  try {
    const image = await QRCode.toDataURL(latestQr, { width: 420, margin: 2 });
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LORD ULTRA QR</title></head><body style="font-family:Arial;text-align:center;background:#f5f5f5;padding:24px"><h2>LORD ULTRA WhatsApp Login</h2><p>Scan using WhatsApp → Linked Devices → Link a Device</p><img alt="WhatsApp login QR" src="${image}" style="width:min(90vw,420px);height:auto;background:white"><p>Keep this page private. QR expires; refresh if needed.</p><script>setTimeout(()=>location.reload(),25000)</script></body></html>`);
  } catch (error) {
    res.status(500).send('Could not render QR.');
  }
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log('LORD ULTRA QR page path: /qr/' + qrToken);
  console.log('Set a Railway public domain to open this page on your phone.');
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

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      latestQr = qr;
      connected = false;
      console.log('A fresh WhatsApp QR is available at /qr/' + qrToken);
      console.log('Scan using WhatsApp Linked Devices.');
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'open') {
      connected = true;
      latestQr = null;
      console.log('LORD ULTRA connected successfully.');
    }
    if (connection === 'close') {
      connected = false;
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
