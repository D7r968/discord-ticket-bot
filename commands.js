'use strict';

const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require('discord.js');

const config = require('./config');
const store = require('./store');
const { buildPanel, askClose, canManage } = require('./tickets');

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

/* ------------------------------------------------------------------ */
/*  تعريف الأوامر                                                      */
/* ------------------------------------------------------------------ */

const commandData = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('إرسال لوحة فتح التذاكر في قناة')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('القناة اللي بتنرسل فيها اللوحة')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('صورة البانر (اختياري — تقدر تغيّرها لاحقاً بأمر /banner)')
    ),

  new SlashCommandBuilder()
    .setName('banner')
    .setDescription('تغيير صورة البوت (البانر)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addAttachmentOption((option) =>
      option.setName('image').setDescription('الصورة الجديدة').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('إغلاق التذكرة الحالية'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('إضافة عضو إلى التذكرة الحالية')
    .addUserOption((option) =>
      option.setName('user').setDescription('العضو').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('إزالة عضو من التذكرة الحالية')
    .addUserOption((option) =>
      option.setName('user').setDescription('العضو').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('تغيير اسم قناة التذكرة الحالية')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('الاسم الجديد')
        .setMinLength(1)
        .setMaxLength(90)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إعادة إرسال لوحة التذاكر في نفس القناة')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('ربط حساب ديسكوردك بلوحة التحكم')
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('الكود اللي ظهر في الموقع')
        .setMinLength(4)
        .setMaxLength(16)
        .setRequired(true)
    )
].map((command) => command.toJSON());

/* ------------------------------------------------------------------ */
/*  أدوات                                                              */
/* ------------------------------------------------------------------ */

function reply(interaction, content, ephemeral = true) {
  return interaction.reply({
    content,
    ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {})
  });
}

function requireTicket(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) {
    reply(interaction, '❌ هذا الأمر يشتغل داخل قناة تذكرة فقط.');
    return null;
  }
  if (!canManage(interaction, ticket)) {
    reply(interaction, '❌ ما عندك صلاحية على هذي التذكرة.');
    return null;
  }
  return ticket;
}

async function saveBanner(attachment) {
  if (!/^image\//i.test(attachment.contentType || '')) {
    throw new Error('الملف لازم يكون صورة (png / jpg / gif / webp).');
  }

  const ext = (path.extname(attachment.name || '').toLowerCase() || '.png');
  const safeExt = IMAGE_EXT.test(ext) ? ext : '.png';
  const imagesDir = path.join(config.ROOT, 'images');

  fs.mkdirSync(imagesDir, { recursive: true });

  // ننزّل الصورة أول، وبعدها نستبدل البانر القديم
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error('تعذّر تنزيل الصورة من ديسكورد.');

  const buffer = Buffer.from(await response.arrayBuffer());

  for (const file of fs.readdirSync(imagesDir)) {
    if (/^banner\./i.test(file)) {
      try {
        fs.unlinkSync(path.join(imagesDir, file));
      } catch {
        /* تجاهل */
      }
    }
  }

  fs.writeFileSync(path.join(imagesDir, `banner${safeExt}`), buffer);

  return `banner${safeExt}`;
}

/* ------------------------------------------------------------------ */
/*  معالجة الأوامر                                                     */
/* ------------------------------------------------------------------ */

async function setup(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const image = interaction.options.getAttachment('image');

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return reply(interaction, '❌ تحتاج صلاحية «إدارة السيرفر» لاستخدام هذا الأمر.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let imageNote = '';

  if (image) {
    try {
      const saved = await saveBanner(image);
      imageNote = `\n🖼️ تم تحديث الصورة: \`images/${saved}\``;
    } catch (err) {
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  }

  const panel = buildPanel();

  try {
    await channel.send(panel);
  } catch {
    return interaction.editReply({
      content: `❌ ما قدرت أرسل اللوحة في <#${channel.id}> — تأكد إن عندي صلاحية الإرسال.`
    });
  }

  return interaction.editReply({
    content: `✅ تم إرسال لوحة التذاكر في <#${channel.id}>.${imageNote}`
  });
}

async function changeBanner(interaction) {
  const image = interaction.options.getAttachment('image', true);

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return reply(interaction, '❌ تحتاج صلاحية «إدارة السيرفر» لاستخدام هذا الأمر.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const saved = await saveBanner(image);
    return interaction.editReply({
      content: `✅ تم تحديث الصورة: \`images/${saved}\`\nالصورة الجديدة بتظهر في اللوحات والتذاكر الجديدة (تقدر تعيد إرسال اللوحة بأمر /panel).`
    });
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err.message}` });
  }
}

async function panelCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return reply(interaction, '❌ تحتاج صلاحية «إدارة السيرفر» لاستخدام هذا الأمر.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.channel.send(buildPanel());
  return interaction.editReply({ content: '✅ تم إرسال اللوحة في هذي القناة.' });
}

async function closeCommand(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) {
    return reply(interaction, '❌ هذا الأمر يشتغل داخل قناة تذكرة فقط.');
  }
  if (!canManage(interaction, ticket)) {
    return reply(interaction, '❌ ما عندك صلاحية على هذي التذكرة.');
  }
  return askClose(interaction);
}

async function addCommand(interaction) {
  const ticket = requireTicket(interaction);
  if (!ticket) return undefined;

  const user = interaction.options.getUser('user', true);

  await interaction.channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true
  });

  return reply(interaction, `✅ تم إضافة ${user} إلى التذكرة.`);
}

async function removeCommand(interaction) {
  const ticket = requireTicket(interaction);
  if (!ticket) return undefined;

  const user = interaction.options.getUser('user', true);

  if (user.id === ticket.ownerId) {
    return reply(interaction, '❌ ما تقدر تشيل صاحب التذكرة نفسه.');
  }

  await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
  return reply(interaction, `✅ تم إزالة ${user} من التذكرة.`);
}

async function renameCommand(interaction) {
  const ticket = requireTicket(interaction);
  if (!ticket) return undefined;

  const name = interaction.options.getString('name', true).trim();

  if (!/^[\p{L}\p{N}\-_ ]+$/u.test(name)) {
    return reply(interaction, '❌ الاسم فيه رموز غير مسموحة. استخدم حروف وأرقام و - و _ فقط.');
  }

  await interaction.channel.setName(name);
  return reply(interaction, `✅ تم تغيير اسم التذكرة إلى **${name}**.`);
}

async function linkCommand(interaction) {
  const isAdmin = !!interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator);
  if (!isAdmin) return reply(interaction, '❌ أمر الربط للأدمن فقط في هذا السيرفر.');

  const code = interaction.options.getString('code', true).trim().toUpperCase();
  const guilds = [];

  for (const guild of interaction.client.guilds.cache.values()) {
    let admin = guild.ownerId === interaction.user.id;
    if (!admin) {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      admin = !!member && member.permissions.has(PermissionFlagsBits.Administrator);
    }
    if (!admin) continue;
    guilds.push({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }) || null,
      owner: guild.ownerId === interaction.user.id,
      botPresent: true,
      memberCount: guild.memberCount
    });
  }

  const base = String(process.env.DASHBOARD_URL || '').trim().replace(/\/+$/, '');
  if (!base) return reply(interaction, '❌ الموقع غير مربوط بالبوت.');

  try {
    const res = await fetch(`${base}/api/link/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-log-token': String(process.env.DASHBOARD_LOG_TOKEN || '').trim()
      },
      body: JSON.stringify({
        code,
        userId: interaction.user.id,
        username: interaction.user.globalName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ size: 128 }),
        guilds
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

    const lines = guilds.map((g) => `• **${g.name}** — \`${g.id}\``).join('\n') || 'لا يوجد';
    return reply(
      interaction,
      `✅ تم ربط حسابك — عندك ${guilds.length} سيرفر تقدر تديره.\n\n${lines}\n\nارجع للموقع واختار السيرفر.`
    );
  } catch (err) {
    console.error('[link]', err.message);
    return reply(interaction, `❌ فشل الربط: ${err.message}`);
  }
}

async function handleCommand(interaction) {
  if (interaction.commandName === 'link') return linkCommand(interaction);
  if (!interaction.inGuild()) {
    return reply(interaction, '❌ الأوامر تشتغل داخل السيرفر فقط.');
  }

  switch (interaction.commandName) {
    case 'link':
      return linkCommand(interaction);
    case 'setup':
      return setup(interaction);
    case 'banner':
      return changeBanner(interaction);
    case 'panel':
      return panelCommand(interaction);
    case 'close':
      return closeCommand(interaction);
    case 'add':
      return addCommand(interaction);
    case 'remove':
      return removeCommand(interaction);
    case 'rename':
      return renameCommand(interaction);
    default:
      return undefined;
  }
}

module.exports = { commandData, handleCommand };
