const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const fs = require('fs');
const http = require('http');
const config = require('./config.json');
const chalk = require('chalk');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.cooldowns = new Collection();

// تحميل قاعدة البيانات
let db = {
    backup: {
        roles: [],
        channels: [],
        members: [],
        settings: {}
    },
    whitelist: config.whitelist || [],
    permanentRoles: config.permanentRoles || [],
    trustedUsers: {},
    antiRaid: {
        joins: []
    }
};

// حفظ قاعدة البيانات
function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// تحميل قاعدة البيانات
if (fs.existsSync('./database.json')) {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
}

// تحميل الأوامر
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// تحميل الأحداث
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client, db, saveDB));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client, db, saveDB));
    }
}

// معالجة الأوامر
client.on('messageCreate', async message => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || 
                   client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    // التحقق من الصلاحيات
    if (command.ownerOnly && message.author.id !== config.ownerId) {
        return message.reply('❌ هذا الأمر متاح فقط لمالك البوت!');
    }

    if (command.permissions && !message.member.permissions.has(command.permissions)) {
        return message.reply('❌ ليس لديك الصلاحيات الكافية لاستخدام هذا الأمر!');
    }

    // نظام الكولداون
    if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`⏱️ الرجاء الانتظار ${timeLeft.toFixed(1)} ثانية قبل استخدام الأمر مرة أخرى.`);
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // تنفيذ الأمر
    try {
        await command.execute(message, args, client, db, saveDB);
    } catch (error) {
        console.error(error);
        message.reply('❌ حدث خطأ أثناء تنفيذ الأمر!');
    }
});

// دالة إرسال اللوقات
client.sendLog = async (embed) => {
    try {
        const logChannel = client.channels.cache.get(config.logChannelId);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('خطأ في إرسال اللوق:', error);
    }
};

// دالة التحقق من الوايت لست
client.isWhitelisted = (userId) => {
    return userId === config.ownerId || db.whitelist.includes(userId);
};

// دالة حفظ نسخة احتياطية تلقائية
function autoBackup() {
    if (!config.backupEnabled) return;
    
    setInterval(async () => {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) return;

        console.log(chalk.blue('[نظام النسخ الاحتياطي] جاري حفظ نسخة احتياطية...'));
        
        // حفظ الرولات
        db.backup.roles = guild.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            permissions: role.permissions.bitfield.toString(),
            position: role.position,
            hoist: role.hoist,
            mentionable: role.mentionable
        }));

        // حفظ الرومات
        db.backup.channels = guild.channels.cache.map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position,
            parentId: channel.parentId,
            permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
                id: po.id,
                type: po.type,
                allow: po.allow.bitfield.toString(),
                deny: po.deny.bitfield.toString()
            }))
        }));

        // حفظ الأعضاء
        db.backup.members = guild.members.cache.map(member => ({
            id: member.id,
            username: member.user.username,
            roles: member.roles.cache.map(r => r.id),
            joinedAt: member.joinedAt
        }));

        saveDB();
        console.log(chalk.green('[نظام النسخ الاحتياطي] تم الحفظ بنجاح ✅'));
    }, config.autoBackupInterval);
}


// سيرفر فحص للاستضافة (Render يرسل PORT تلقائياً)
let loginState = 'starting';
let loginError = '';
if (process.env.PORT) {
  const port = Number(process.env.PORT) || 3000;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          bot: client.user?.tag || 'starting',
          login: loginState,
          loginError,
          uptimeSeconds: Math.floor(process.uptime())
        })
      );
    })
    .listen(port, '0.0.0.0', () => console.log('[i] منفذ الفحص شغال على ' + port));
}

// self-ping داخلي كل 5 دقائق عشان Render ما يرقد
const selfPingUrl = String(process.env.SELF_PING_URL || '').trim();
if (selfPingUrl) {
  setInterval(async () => {
    try {
      await fetch(selfPingUrl, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
      console.error('[!] فشل الـ self ping:', err.message);
    }
  }, 5 * 60 * 1000).unref();
  console.log('[i] self ping مفعّل كل 5 دقائق: ' + selfPingUrl);
}

process.on('SIGTERM', () => {
  console.log('[i] SIGTERM — إغلاق آمن...');
  client.destroy();
  process.exit(0);
});

// تسجيل الدخول
const botToken = String(process.env.DISCORD_TOKEN || config.token || '').trim();
if (!botToken || botToken.includes('ضع_')) {
  console.error('[!] ما فيه توكن — حط DISCORD_TOKEN في المتغيرات');
  process.exit(1);
}

client.login(botToken)
  .then(() => {
    loginState = 'logged_in';
    autoBackup();
  })
  .catch(error => {
    loginState = 'failed';
    loginError = String(error?.message || error);
    console.error(chalk.red('خطأ في تسجيل الدخول:'), error);
    process.exit(1);
  });

// معالجة الأخطاء
process.on('unhandledRejection', error => {
    console.error(chalk.red('خطأ غير معالج:'), error);
});

process.on('uncaughtException', error => {
    console.error(chalk.red('استثناء غير معالج:'), error);
});

module.exports = client;
