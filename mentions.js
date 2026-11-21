'use strict';

const { EmbedBuilder, PermissionFlagsBits, MessageType } = require('discord.js');
const config = require('./config');

/* منشن أول وثاني = تحذير، منشن ثالث ورا بعض = تايم أوت */
const records = new Map();
const REQUIRED = 3;

// تُقرأ من config عند كل استخدام عشان تتحدث فوراً من لوحة التحكم
function windowHours() { return Math.max(1, Number(config.mentionWarnHours) || 24); }
function windowMs() { return windowHours() * 60 * 60 * 1000; }
function timeoutHours() { return Math.max(1, Number(config.mentionTimeoutHours) || 3); }
function timeoutMs() { return timeoutHours() * 60 * 60 * 1000; }

function warningEmbed(count, remaining) {
  return new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('⚠️ تحذير: لا تمنشن الأعضاء مباشرة')
    .setDescription(
      `هذا منشنك رقم **${count} من ${REQUIRED}**. استخدم زر التذاكر أو الأوامر بدال المنشن.\n` +
        `**المنشن الثالث خلال ${windowHours()} ساعة = تايم أوت ${timeoutHours()} ساعات.**`
    )
    .addFields({ name: 'تحذيراتك', value: `${count} من ${REQUIRED}`, inline: true })
    .setFooter({ text: `ينتهي العد بعد ${remaining} ساعة تقريباً` })
    .setTimestamp();
}

function timeoutEmbed() {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🔇 تم تطبيق التايم أوت')
    .setDescription(
      `تم إعطاء تايم أوت **${timeoutHours()} ساعات** بسبب ${REQUIRED} منشنات ورا بعض.\n` +
        'المرة الجاية استخدم زر التذاكر أو الأوامر بدون منشن.'
    )
    .setTimestamp();
}

async function handleMention(message, client) {
  try {
    if (!message.guild || message.author.bot || message.system) return;
    if (!client.user || message.author.id === client.user.id) return;
    if (message.type !== MessageType.Default) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const hasMention = Array.from(message.mentions.users.keys()).some((id) => id !== message.author.id);

    // رسالة بدون منشن → نبدأ عدّاد جديد (لازم يكونوا ورا بعض)
    if (!hasMention) {
      records.delete(key);
      return;
    }

    const now = Date.now();
    let record = records.get(key);
    if (!record || now - record.firstAt > windowMs()) {
      record = { count: 0, firstAt: now };
    }

    record.count += 1;
    records.set(key, record);

    if (record.count < REQUIRED) {
      const remaining = Math.max(1, Math.ceil((windowMs() - (now - record.firstAt)) / 3600000));
      await message
        .reply({
          embeds: [warningEmbed(record.count, remaining)],
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    // المنشن الثالث
    if (config.mentionTimeoutEnabled === false) {
      records.delete(key);
      await message
        .reply({
          content: `⚠️ هذا منشنك الثالث! التايم أوت معطّل حالياً من الإعدادات.`,
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    const me = message.guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await message
        .reply({
          content: '⚠️ منشنك الثالث! ما عندي صلاحية **Timeout Members** عشان أطبّق التايم أوت.',
          allowedMentions: { repliedUser: false }
        })
        .catch(() => {});
      return;
    }

    try {
      const member = message.member || (await message.guild.members.fetch(message.author.id));

      await member.timeout(timeoutMs(), `٣ منشنات ورا بعض (تحذيرين ثم تايم أوت ${timeoutHours()} ساعات)`);

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
