export const commandCategories = {
  'GEN-CMD': 'alive apk attp botinfo botstatus checkwa circlesticker crop delpp egif fancy getpp getsettings google image2 define news2 groupinfo groupstats help img inviteinfo lid menu myactivity owner pair ping poll qr reshare setprofile simage testsnapshot ssweb sticker stickerpack take telepack time tts uptime write'.split(' '),
  'AI-CMD': 'ai chatgpt gpt4o claude gemini mistral copilot metaai llama blackbox bard perplexity venice o3'.split(' '),
  'ADM-CMD': 'add all antiall antiaudio antibadword antibot anticontact antidemote antiforward antigif antigroupmention antiimage antikickall antilink antipromote antispam antisticker antitag antitagadmins antivideo antiviewonce approve autosticker chatbot clean demote demoteall disp antiforeign getgroupdesc getgroupprofile goodbye grouplink hidetag join kick kickactive kickinactive killgc listoffline listonline mute promote reject resetwarn revokelink setgdesc setgname setgoodbye setgroupprofile setsticker setwelcome staff tagall unmute vcf warn welcome'.split(' '),
  'OWN-CMD': 'addsudo alwaysonline antibug anticall anticallmsg antidelete antideletestatus antiedit autodownloadstatus automedia autoreact autoread autorecording autorecordtype autostatusemoji autostatusreact autostatusview autotyping block broadcast calllink cat creategc delete dgns forward getjid getsession groupstatus invite leave mode mygroups newsletter pinger readreceipts removesudo resetbot restart savestatus setfont setgitmedialink setigmedialink setmaxwarn setprefix shutdown stealth sudolist disable enable tostatus unblock viewonce'.split(' '),
  'MEDIA-CMD': 'facebook igs igsc instagram lyrics pinterest play2 ptv shazam snapchat play soundcloud spotify spotify2 tiktok2 trim tt twitter video video2 video3 ytsearch'.split(' '),
  'SPORT-CMD': 'playersearch kteamsearch venuesearch gameevents fifaupcoming fifamatches fifastandings fifascorers livescore livehighlights epl bundesliga euros laliga ligue1 seriea ucl bet footballnews'.split(' '),
  'FUN-CMD': 'bomb compliment fact flirt gayrate insult joke meme memesearch paranoia pickupline pies question quotes ship tictactoe tod ttt2 wasted wyr'.split(' '),
  'UTIL-CMD': 'calc pin unpin pinmsg unpinmsg starmsg translate2 wame weather'.split(' '),
  'ANIME-CMD': 'hneko hwaifu konachan megumin milf random waifu neko loli shota husby'.split(' '),
  'MAKER-CMD': '1917 arena blackpink devil fire glitch hacker ice impressive leaves light matrix metallic neon purple sand snow thunder'.split(' '),
  'AIVIDEO-CMD': 'introvideo lightningpubg lovevideo tigervideo videogen videomenu'.split(' '),
  'CONVERT-CMD': 'tomp3 tovideo toexcel toword topdf togif'.split(' ')
};

export function buildMenu({ prefix = '.', owner = 'Not set', mode = 'Public', version = '1.0.0', uptime = 'unknown', speed = 'unknown', platform = process.platform, ram = process.memoryUsage().rss } = {}) {
  const usedMb = (ram / 1024 / 1024).toFixed(1);
  const totalMb = (requireTotalMemory() / 1024 / 1024).toFixed(0);
  const lines = [
    '┏━━❐◈LORD ULTRA◈',
    `┃ *PREFIX:* ${prefix}`,
    `┃ *OWNER:* ${owner}`,
    `┃ *MODE:* ${mode}`,
    `┃ *PLATFORM:* ${platform}`,
    `┃ *SPEED:* ${speed}`,
    `┃ *UPTIME:* ${uptime}`,
    `┃ *VERSION:* ${version}`,
    `┃ *USAGE:* ${usedMb} MB`,
    `┃ *RAM:* ${usedMb} / ${totalMb} MB`,
    `┃ *COMMANDS:* ${Object.values(commandCategories).reduce((n, a) => n + a.length, 0)}`,
    '┗❐'
  ];
  for (const [category, commands] of Object.entries(commandCategories)) {
    lines.push('', `┏━━❐◈  ${category} ◈`);
    for (const command of commands) lines.push(`┃◈${command}`);
    lines.push('┗❐');
  }
  lines.push('', 'ℹ️ Only .ping and .menu are currently active. Other listed commands are planned and will be enabled as modules are implemented.');
  return lines.join('\n');
}

function requireTotalMemory() {
  // Node's built-in os module is loaded lazily to keep this module dependency-free.
  return process.memoryUsage().heapTotal > 0 ? Number(process.env.RAM_TOTAL_BYTES || 0) || 1 : 1;
}
