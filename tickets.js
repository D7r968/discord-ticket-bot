'use strict';

const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} = require('discord.js');

const config = require('./config');
const store = require('./store');
const { getBanner } = require('./banner');
const { getType, options } = require('./ticketTypes');

const P = PermissionFlagsBits;
const TRANSCRIPTS_DIR = path.join(config.ROOT, 'transcripts');

/* ------------------------------------------------------------------ */
/*  أدوات مساعدة                                                      */
/* ------------------------------------------------------------------ */

function isSnowflake(value) {
  return /^\d{15,25}$/.test(String(value || '').trim());
}

function bannerPayload(embed) {
  const banner = getBanner();
  if (!banner) return { embeds: [embed] };
  embed.setImage(`attachment://${banner.name}`);
  return { embeds: [embed], files: [{ attachment: banner.path, name: banner.name }] };
}

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription)
    .addFields(
      { name: '🛒 شراء من متجر', value: 'طلب منتجات وعمليات الشراء', inline: true },
      { name: '❓ استفسار', value: 'أسئلة واستفسارات عامة', inline: true },
      { name: '🛠️ حل مشكلة', value: 'بلّغ عن مشكلة واطلب المساعدة', inline: true }
    )
    .setFooter({ text: 'اضغط الزر → اختر النوع → تنفتح لك قناة خاصة' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:menu')
      .setLabel(config.panelButtonLabel)
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  return { ...bannerPayload(embed), components: [row] };
}

/* القائمة اللي تطلع بعد أول ضغطة */
async function showTicketMenu(interaction) {
  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle('اختر نوع التذكرة 🎫')
    .setDescription(
      'تم ✅ — الآن اختر سبب فتح التذكرة، وبنحوّلك للقسم المناسب.\n' +
        'ما تلقى نوعك؟ اختر **استفسار** واكتب كل شي تحت.'
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:type')
    .setPlaceholder('اختر نوع التذكرة من القائمة')
    .addOptions(
      options().map((type) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(type.label)
          .setValue(type.key)
          .setDescription(type.description)
          .setEmoji(type.emoji)
      )
    );

  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral
  });
}

async function handleSelect(interaction) {
  if (interaction.customId !== 'ticket:type') return undefined;

  const type = getType(interaction.values[0]);
  if (!type) {
    return interaction.update({
      content: '❌ خيار غير صالح، جرّب مرة ثانية.',
      embeds: [],
      components: []
    });
  }

  await interaction.update({
    content: '⏳ جاري تجهيز التذكرة، لحظة...',
    embeds: [],
    components: []
  });

  return openTicket(interaction, interaction.values[0]);
}

function ticketControls(claimed) {
  const claim = new ButtonBuilder()
    .setCustomId('ticket:claim')
    .setLabel(claimed ? `مستلمة: ${claimed.username}` : 'استلام')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(Boolean(claimed));

  const close = new ButtonBuilder()
    .setCustomId('ticket:close')
    .setLabel('إغلاق التذكرة')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(claim, close);
}

function canManage(interaction, ticket) {
  if (interaction.user.id === ticket.ownerId) return true;

  const member = interaction.member;
  if (member?.permissions?.has(P.ManageChannels)) return true;

  const roleId = String(config.supportRoleId || '').trim();
  if (isSnowflake(roleId) && member?.roles?.cache?.has(roleId)) return true;

  return false;
}

async function ephemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => {});
  }
  return interaction.reply(payload).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  فتح تذكرة                                                          */
/* ------------------------------------------------------------------ */

async function openTicket(interaction, typeKey = 'inquiry') {
  const { guild, user } = interaction;
  const type = getType(typeKey) || getType('inquiry');

  if (!guild) {
    return ephemeral(interaction, '❌ التذاكر تشتغل داخل السيرفر فقط.');
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  // هل عنده تذكرة مفتوحة؟
  const existing = store.findOpenTicket(guild.id, user.id);
  if (existing) {
    const channel =
      guild.channels.cache.get(existing.channelId) ||
      (await guild.channels.fetch(existing.channelId).catch(() => null));

    if (channel) {
      return interaction.editReply({ content: `عندك تذكرة مفتوحة بالفعل: <#${channel.id}>` });
    }
    store.removeTicket(existing.channelId);
  }

  const limit = Number(config.ticketLimit) || 1;
  if (store.countOpenByUser(guild.id, user.id) >= limit) {
    return interaction.editReply({
      content: 'وصلت للحد الأقصى من التذاكر المفتوحة. أغلق تذكرتك الحالية أول.'
    });
  }

  // القسم (Category)
  let category = null;
  const categoryId = String(config.categoryId || '').trim();
  if (isSnowflake(categoryId)) {
    category =
      guild.channels.cache.get(categoryId) ||
      (await guild.channels.fetch(categoryId).catch(() => null));
  }

  if (!category) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets'
    );
  }

  if (!category) {
    category = await guild.channels.create({
      name: 'Tickets',
      type: ChannelType.GuildCategory,
      reason: 'إنشاء قسم التذاكر تلقائياً'
    });
  }

  // رتبة الدعم
  let supportRole = null;
  const roleId = String(config.supportRoleId || '').trim();
  if (isSnowflake(roleId)) {
    supportRole =
      guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
  }

  const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: user.id, allow },
    { id: interaction.client.user.id, allow }
  ];
  if (supportRole) overwrites.push({ id: supportRole.id, allow });

  const number = store.nextNumber();

  let channel;
  try {
    channel = await guild.channels.create({
      name: `${type.prefix}-${String(number).padStart(3, '0')}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `تذكرة #${number} • ${type.label} • صاحبها: ${user.tag} (${user.id})`,
      permissionOverwrites: overwrites,
      reason: `تذكرة ${type.label} من ${user.tag}`
    });
  } catch (err) {
    console.error('[!] فشل إنشاء قناة التذكرة:', err.message);
    return interaction.editReply({
      content:
        '❌ ما قدرت أفتح التذكرة. تأكد إن رتبة البوت أعلى من رتبة الدعم، وإن عنده صلاحيات «إدارة القنوات».'
    });
  }

  store.addTicket(channel.id, {
    guildId: guild.id,
    ownerId: user.id,
    number,
    type: interaction.values ? interaction.values[0] : typeKey,
    createdAt: Date.now(),
    claimedBy: null
  });

  const embed = new EmbedBuilder()
    .setColor(type.color)
    .setTitle(`${type.emoji} ${type.title} #${number}`)
    .setDescription(`${type.intro}\n\n${config.ticketWelcomeDescription}`)
    .addFields(
      { name: '👤 صاحب التذكرة', value: `<@${user.id}>`, inline: true },
      { name: '📌 النوع', value: type.label, inline: true },
      {
        name: '📝 اكتب لنا بالترتيب',
        value: type.questions.map((q, index) => `${index + 1}. ${q}`).join('\n')
      }
    )
    .setFooter({ text: `رقم التذكرة #${number} • ${guild.name}` })
    .setTimestamp();

  await channel.send({
    content: `${user}${supportRole ? ` | ${supportRole}` : ''}`,
    ...bannerPayload(embed),
    components: [ticketControls(null)]
  });

  await interaction.editReply({
    content: `✅ تم فتح تذكرتك (**${type.label}**): <#${channel.id}>`
  });
  return channel;
}

/* ------------------------------------------------------------------ */
/*  استلام التذكرة                                                     */
/* ------------------------------------------------------------------ */

async function claimTicket(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) {
    return ephemeral(interaction, '❌ هذي القناة مو تذكرة مسجلة.');
  }

  if (ticket.claimedBy) {
    return ephemeral(interaction, `التذكرة مستلمة بالفعل بواسطة <@${ticket.claimedBy}>`);
  }

  ticket.claimedBy = interaction.user.id;
  store.addTicket(interaction.channelId, ticket);

  await interaction.update({
    components: [ticketControls({ id: interaction.user.id, username: interaction.user.username })]
  });

  await interaction
    .followUp({ content: `🙋 تم استلام التذكرة بواسطة ${interaction.user}` })
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  إغلاق التذكرة                                                      */
/* ------------------------------------------------------------------ */

async function askClose(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) {
    return ephemeral(interaction, '❌ هذي القناة مو تذكرة مسجلة.');
  }

  if (!canManage(interaction, ticket)) {
    return ephemeral(interaction, '❌ ما عندك صلاحية إغلاق هذي التذكرة.');
  }

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('إغلاق التذكرة')
    .setDescription('متأكد؟ بينحفظ سجل المحادثة في مجلد transcripts وبعدها بتنحذف القناة.');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:confirm')
      .setLabel('نعم، أغلق التذكرة')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:cancel')
      .setLabel('إلغاء')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function saveTranscript(channel, ticket) {
  try {
    const collected = [];
    let before;

    for (let i = 0; i < 10; i += 1) {
      const batch = await channel.messages.fetch({
        limit: 100,
        ...(before ? { before } : {})
      });

      if (!batch.size) break;

      collected.push(...batch.values());
      before = batch.last().id;

      if (batch.size < 100) break;
    }

    collected.reverse();

    const lines = [
      `سجل التذكرة #${ticket.number}`,
      `النوع: ${getType(ticket.type)?.label || ticket.type || 'عام'}`,
      `القناة: #${channel.name} (${channel.id})`,
      `صاحب التذكرة: ${ticket.ownerId}`,
      `تاريخ الفتح: ${new Date(ticket.createdAt).toISOString()}`,
      `تاريخ الإغلاق: ${new Date().toISOString()}`,
      '-'.repeat(60)
    ];

    for (const message of collected) {
      lines.push(
        `[${message.createdAt.toISOString()}] ${message.author.tag}: ${
          message.content || '(بدون نص — فعّل Message Content Intent لسجل كامل)'
        }`
      );

      for (const attachment of message.attachments.values()) {
        lines.push(`    📎 ${attachment.name}: ${attachment.url}`);
      }

      for (const embed of message.embeds) {
        const text = [embed.title, embed.description].filter(Boolean).join(' — ');
        if (text) lines.push(`    [embed] ${text}`);
      }
    }

    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
    const file = path.join(
      TRANSCRIPTS_DIR,
      `ticket-${String(ticket.number).padStart(3, '0')}-${channel.id}.txt`
    );

    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    return file;
  } catch (err) {
    console.error('[!] فشل حفظ سجل التذكرة:', err.message);
    return null;
  }
}

async function sendLog(guild, closer, ticket, transcriptPath) {
  const logId = String(config.logChannelId || '').trim();
  if (!isSnowflake(logId)) return;

  const channel =
    guild.channels.cache.get(logId) ||
    (await guild.channels.fetch(logId).catch(() => null));

  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('🔒 تم إغلاق تذكرة')
    .addFields(
      { name: 'رقم التذكرة', value: `#${ticket.number}`, inline: true },
      { name: 'النوع', value: getType(ticket.type)?.label || 'عام', inline: true },
      { name: 'صاحب التذكرة', value: `<@${ticket.ownerId}>`, inline: true },
      { name: 'أغلقها', value: `${closer}`, inline: true }
    )
    .setTimestamp();

  await channel
    .send({
      embeds: [embed],
      files: transcriptPath
        ? [{ attachment: transcriptPath, name: path.basename(transcriptPath) }]
        : []
    })
    .catch(() => {});
}

async function confirmClose(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) {
    return ephemeral(interaction, '❌ هذي القناة مو تذكرة مسجلة.');
  }

  if (!canManage(interaction, ticket)) {
    return ephemeral(interaction, '❌ ما عندك صلاحية إغلاق هذي التذكرة.');
  }

  await interaction.update({
    content: '⏳ جاري إغلاق التذكرة وحفظ سجل المحادثة...',
    embeds: [],
    components: []
  });

  const channel = interaction.channel;
  const transcriptPath = await saveTranscript(channel, ticket);

  await sendLog(interaction.guild, interaction.user, ticket, transcriptPath);

  // نسخة للسجل في الخاص عند صاحب التذكرة
  try {
    const owner = await interaction.client.users.fetch(ticket.ownerId);
    await owner.send({
      content: `تم إغلاق تذكرتك رقم #${ticket.number} (${getType(ticket.type)?.label || 'عام'}) في سيرفر **${interaction.guild.name}**.`,
      files: transcriptPath
        ? [{ attachment: transcriptPath, name: path.basename(transcriptPath) }]
        : []
    });
  } catch {
    /* الخاص مقفل — تجاهل */
  }

  store.removeTicket(channel.id);

  setTimeout(() => {
    channel.delete('تم إغلاق التذكرة').catch(() => {});
  }, 4000);
}

/* ------------------------------------------------------------------ */
/*  توجيه أزرار التذاكر                                                */
/* ------------------------------------------------------------------ */

async function handleButton(interaction) {
  const [scope, action] = interaction.customId.split(':');
  if (scope !== 'ticket') return;

  switch (action) {
    // اللوحات القديمة لسا فيها زر open — نوجّهه للقائمة الجديدة
    case 'open':
    case 'menu':
      return showTicketMenu(interaction);

    case 'claim':
      return claimTicket(interaction);

    case 'close':
      return askClose(interaction);

    case 'confirm':
      return confirmClose(interaction);

    case 'cancel':
      return interaction.update({
        content: 'تم إلغاء الإغلاق ✅',
        embeds: [],
        components: []
      });

    default:
      return undefined;
  }
}

module.exports = {
  buildPanel,
  showTicketMenu,
  handleSelect,
  openTicket,
  claimTicket,
  askClose,
  confirmClose,
  handleButton,
  canManage,
  isSnowflake,
  bannerPayload
};
