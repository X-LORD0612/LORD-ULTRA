import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { buildMenu } from './menu.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const prefix = process.env.PREFIX || '.';
const startedAt = Date.now();
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
      console.log('\nScan this QR with WhatsApp Linked Devices:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('LORD ULTRA connected successfully.');
    if (connection === 'close') {
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
      const [command] = body.slice(prefix.length).trim().split(/\s+/);
      if (command?.toLowerCase() === 'ping') {
        await sock.sendMessage(jid, { text: 'Pong! LORD ULTRA is online ⚡' }, { quoted: msg });
      } else if (command?.toLowerCase() === 'menu') {
        await sock.sendMessage(jid, { text: '*LORD ULTRA MENU*\n\n.ping — Check bot status\n.menu — Show this menu' }, { quoted: msg });
      }
    }
  });
}

startBot().catch(err => {
  console.error('Failed to start LORD ULTRA:', err);
  process.exitCode = 1;
});
