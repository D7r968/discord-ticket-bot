'use strict';

require('dotenv').config();

const http = require('http');
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const config = require('./config');
const store = require('./store');
const { commandData, handleCommand } = require('./commands');
const { handleButton, handleSelect } = require('./tickets');
const { handleMention } = require('./mentions');
const { describeBanner } = require('./banner');

const token = String(process.env.DISCORD_TOKEN || '').trim();

// حالة التسجيل عشان نعرف من الـ health لو اللوجات ما ظهرت
let loginStatus = 'starting';
let loginDetail = '';
let egressStatus = 'untested';
let wsStatus = 'untested';
let gatewayBotStatus = 'untested';

// فحص سريع للاتصال الخارجي (يساعد في تشخيص الاستضافات)
(async () => {
  try {
    const res = await fetch('https://discord.com/api/v10/gateway', {
      signal: AbortSignal.timeout(10000)
    });
    egressStatus = `http_${res.status}`;
    console.log(`[i] اتصال discord.com: ${egressStatus}`);
  } catch (err) {
    egressStatus = `failed: ${err.message}`;
    console.error(`[!] اتصال discord.com فشل: ${err.message}`);
  }
})();

// فحص منفصل لاتصال WebSocket بالـ Gateway (نقطة تعليق discord.js)
(async () => {
  try {
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    const timer = setTimeout(() => {
      wsStatus = 'timeout';
      try { ws.close(); } catch { /* ignore */ }
    }, 12000);
    ws.onopen = () => {
      wsStatus = 'open';
      clearTimeout(timer);
      console.log('[i] WebSocket gateway: open');
      try { ws.close(); } catch { /* ignore */ }
    };
    ws.onerror = () => {
      wsStatus = 'error';
      clearTimeout(timer);
      console.error('[!] WebSocket gateway: error');
    };
  } catch (err) {
    wsStatus = `exception: ${err.message}`;
    console.error(`[!] WebSocket gateway exception: ${err.message}`);
  }
})();

// فحص نقطة /gateway/bot بالتوكن (اللي يستخدمه discord.js قبل فتح الوصلة)
(async () => {
  try {
    const res = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    const text = await res.text();
    gatewayBotStatus = `http_${res.status} len=${text.length}`;
    if (res.status === 429) {
      try {
        const j = JSON.parse(text);
        gatewayBotStatus += ` retry_after=${j.retry_after} global=${j.global}`;
      } catch { /* ignore */ }
    }
    console.log(`[i] gateway/bot: ${gatewayBotStatus}`);
  } catch (err) {
    gatewayBotStatus = `failed: ${err.message}`;
    console.error(`[!] gateway/bot فشل: ${err.message}`);
  }
})();

const TOKEN_PLACEHOLDERS = ['', 'ضع_التوكن_هنا', 'YOUR_TOKEN', 'TOKEN'];

if (TOKEN_PLACEHOLDERS.includes(token)) {
  console.error(
    '\n[!] ما فيه توكن للبوت.\n' +
      '    1) افتح ملف .env\n' +
      '    2) حط التوكن في DISCORD_TOKEN=\n' +
      '    3) شغّل start.bat مرة ثانية\n'
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.on(Events.Debug, (msg) => console.log('[debug]', msg));

client.once(Events.ClientReady, async (c) => {
  console.log('====================================');
  console.log(`[✓] تم تسجيل الدخول: ${c.user.tag}`);
  console.log(`[i] السيرفرات: ${c.guilds.cache.size}`);
  console.log(`[i] الصورة: ${describeBanner()}`);

  const guildId = String(process.env.GUILD_ID || '').trim();
  const guild = guildId ? c.guilds.cache.get(guildId) : null;

  try {
    if (guild) {
      await guild.commands.set(commandData);
      console.log(`[✓] تم تسجيل الأوامر في: ${guild.name}`);
    } else {
      await c.application.commands.set(commandData);
      console.log('[✓] تم تسجيل الأوامر عالمياً (تحتاج دقائق عشان تظهر)');
    }
  } catch (err) {
    console.error('[!] فشل تسجيل الأوامر:', err.message);
  }

  // تنظيف التذاكر اللي انحذفت قنواتها
  for (const channelId of Object.keys(store.allTickets())) {
    const exists = c.channels.cache.has(channelId);
    if (!exists) store.removeTicket(channelId);
  }

  console.log(`[i] التذاكر المفتوحة: ${Object.keys(store.allTickets()).length}`);
  console.log('====================================');
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return await handleCommand(interaction);
    if (interaction.isButton()) return await handleButton(interaction);
    if (interaction.isStringSelectMenu()) return await handleSelect(interaction);
  } catch (err) {
    console.error('[!] خطأ في التفاعل:', err);

    const payload = {
      content: '❌ صار خطأ غير متوقع. جرّب مرة ثانية أو راسل الإدارة.',
      flags: MessageFlags.Ephemeral
    };

    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch {
      /* تجاهل */
    }
  }
});

// أي منشن للبوت: تحذير أول، ثم تايم أوت 3 ساعات في المرة الثانية
client.on(Events.MessageCreate, (message) => handleMention(message, client));

// سيرفر صغير عشان الاستضافات اللي تطلب منفذ HTTP (Render / Railway / Koyeb ...)
if (process.env.PORT) {
  const port = Number(process.env.PORT) || 3000;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          bot: client.user?.tag || 'starting',
          login: loginStatus,
          loginDetail,
          egress: egressStatus,
          ws: wsStatus,
          gatewayBot: gatewayBotStatus,
          uptimeSeconds: Math.floor(process.uptime())
        })
      );
    })
    .listen(port, '0.0.0.0', () => console.log(`[i] منفذ الفحص شغال على ${port}`));
}

// self-ping: طلب داخلي كل 5 دقائق عشان Render ما يرقد بعد 15 دقيقة سكون
const selfPingUrl = String(process.env.SELF_PING_URL || '').trim();
if (selfPingUrl) {
  setInterval(async () => {
    try {
      await fetch(selfPingUrl, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
      console.error('[!] فشل الـ self ping:', err.message);
    }
  }, 5 * 60 * 1000).unref();
  console.log(`[i] self ping مفعّل كل 5 دقائق: ${selfPingUrl}`);
}

process.on('SIGTERM', () => {
  console.log('[i] استلام SIGTERM — إغلاق البوت بأمان...');
  client.destroy();
  process.exit(0);
});

client.on(Events.Error, (err) => console.error('[!] خطأ العميل:', err));
client.on(Events.Warn, (msg) => console.warn('[!] تحذير:', msg));

process.on('unhandledRejection', (err) => console.error('[!] unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('[!] uncaughtException:', err));

loginStatus = 'logging_in';
console.log('[i] جاري تسجيل الدخول إلى Discord...');

client
  .login(token)
  .then(() => {
    loginStatus = 'logged_in';
    console.log('[✓] تم استلام وعد تسجيل الدخول بنجاح');
  })
  .catch((err) => {
    loginStatus = 'failed';
    loginDetail = String(err?.message || err);
    console.error('[!] فشل تسجيل الدخول:', err);
  });

// إذا ما أكتمل الدخول خلال 45 ثانية، نطبع سبب محتمل عشان التشخيص
setTimeout(() => {
  if (loginStatus !== 'logged_in') {
    console.error(`[!] الدخول ما اكتمل بعد 45 ثانية — الحالة: ${loginStatus} ${loginDetail}`);
    if (loginStatus === 'logging_in') {
      loginStatus = 'timeout';
      loginDetail = 'client.login did not settle within 45s';
    }
  }
}, 45000).unref();
