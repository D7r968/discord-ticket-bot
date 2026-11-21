'use strict';

const { EmbedBuilder, PermissionFlagsBits, MessageType } = require('discord.js');
const config = require('./config');

/* منشن أول = تحذير، منشن ثاني = تايم أوت */
const records = new Map();

const WINDOW_HOURS = Math.max(1, Number(config.mentionWarnHours) || 24);
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const TIMEOUT_HOURS = Math.max(1, Number(config.mentionTimeoutHours) || 3);
const TIMEOUT_MS = TIMEOUT_HOURS * 60 * 60 * 1000;

function warningEmbed(remaining) {
  return new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('⚠️ تحذير: لا تمنشن البوت مباشرة')
    .setDescription(
      'هذا تحذيرك الأول. استخدم زر التذاكر أو الأوامر بدال المنشن.\n' +
        `**المنشن الثاني خلال ${WINDOW_HOURS} ساعة = تايم أوت ${TIMEOUT_HOURS} ساعات.**`
    )
    .addFields({ name: 'التحذيرات عندك', value: `1 من 2`, inline: true })
    .setFooter({ text: `ينتهي التحذير بعد ${remaining} ساعة تقريباً` })
    .setTimestamp();
}

function timeoutEmbed() {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🔇 تم تطبيق التايم أوت')
    .setDescription(
      `تم إعطاء تايم أوت **${TIMEOUT_HOURS} ساعات** بسبب منشن البوت مرتين.\n` +
        'المرة الجاية استخدم زر التذاكر أو الأوامر بدون منشن.'
    )
    .setTimestamp();
}

async function handleMention(message, client) {
  try {
    if (!message.guild || message.author.bot || message.system) return;
    if (!client.user || message.author.id === client.user.id) return;
    if (message.type !== MessageType.Default) return;
    if (!message.mentions.users.has(client.user.id)) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();

    let record = records.get(key);
    if (!record || now - record.firstAt > WINDOW_MS) {
      record = { count: 0, firstAt: now };
    }

    record.count += 1;
    records.set(key, record);

    if (record.count === 1) {
      const remaining = Math.max(1, Math.ceil((WINDOW_MS - (now - record.firstAt)) / 3600000));
      await message
        .reply({
          embeds: [warningEmbed(remaining)],
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    // المنشن الثاني
    if (config.mentionTimeoutEnabled === false) {
      records.delete(key);
      await message
        .reply({
          content: '⚠️ هذا منشنك الثاني! التايم أوت معطّل حالياً من الإعدادات.',
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    const me = message.guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await message
        .reply({
          content: '⚠️ منشنك الثاني! ما عندي صلاحية **Timeout Members** عشان أطبّق التايم أوت.',
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    try {
      const member = message.member || (await message.guild.members.fetch(message.author.id));

      await member.timeout(TIMEOUT_MS, `منشن البوت مرتين (تحذير ثم تايم أوت ${TIMEOUT_HOURS} ساعات)`);

      records.delete(key);

      await message.channel.send({
        embeds: [timeoutEmbed()],
        allowedMentions: { parse: [] }
      }).catch(() => {});
    } catch (err) {
      console.error('[!] فشل تطبيق التايم أوت:', err.message);
      await message
        .reply({
          content: '❌ ما قدرت أطبّق التايم أوت — غالباً رتبتي تحت رتبتك. راسل الإدارة.',
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error('[!] خطأ في مراقبة المنشن:', err.message);
  }
}

module.exports = { handleMention, records };
