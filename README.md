# LORD ULTRA ⚡

A personal WhatsApp multi-device bot starter.

## Requirements
- Node.js 20 or newer
- WhatsApp account

## Setup
```bash
git clone https://github.com/X-LORD0612/LORD-ULTRA.git
cd LORD-ULTRA
npm install
cp .env.example .env
npm start
```

Scan the QR shown in the terminal using WhatsApp → Linked devices → Link a device.

## Commands
- `.ping` — check whether the bot is online
- `.menu` — show the 12-category LORD ULTRA command menu

Set `PREFIX` in `.env` to change the command prefix.

## Security
Never upload your `.env` file or the `session/` directory. They contain private configuration and WhatsApp login credentials.

## Status
This is the initial connection and command framework. Additional modules such as music, downloads, group administration, and owner controls still need to be implemented and tested.


The menu lists the planned command set. At this stage, only `.ping` and `.menu` are implemented; the other commands are placeholders until their modules are added and tested. Configure `OWNER` and `MODE` in `.env` if desired.
