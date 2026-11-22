'use strict';

const fs = require('fs');
const path = require('path');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { PermissionFlagsBits } = require('discord.js');
const voiceCommandData = require('./voice-commands');

const P = PermissionFlagsBits;

/**
 * يضيف أوامر الروم (/join /leave /status) لأي بوت.
 * الاستخدام في index.js حق البوت:
 *
 *   const attachVoice = require('./voice');
 *   const voice = attachVoice(client, { ghRepo: '...', log, warn });
 *   // في ready:      await voice.restore();
 *   // في interactionCreate: if (await voice.handle(interaction)) return;
 *   // في تسجيل الأوامر: ...voice.commands()
 */
module.exports = function attachVoice(client, opts = {}) {
  const stateFile = opts.stateFile || path.join(__dirname, 'voice-state.json');
  const ghPath = opts.ghPath || 'voice-state.json';
  const ghToken = String(opts.ghToken || process.env.GH_TOKEN || '').trim();
  const ghOwner = opts.ghOwner || process.env.GH_OWNER || 'D7r968';
  const ghRepo = String(opts.ghRepo || process.env.GH_REPO || '').trim();
  const log = opts.log || ((...a) => console.log(...a));
  const warn = opts.warn || ((...a) => console.warn(...a));

  let state = {};
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (raw && typeof raw === 'object') state = raw;
  } catch { /* أول تشغيل */ }

  function saveLocal() {
    try { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); }
    catch (e) { warn('[voice] فشل الحفظ المحلي:', e.message); }
  }

  async function save() {
    saveLocal();
    if (!ghToken || !ghRepo) return;
    try {
      const api = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${ghPath}`;
      const h = {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'bot-voice',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      const cur = await fetch(api, { headers: h });
      const j = cur.ok ? await cur.json() : {};
      const r = await fetch(api, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({
          message: 'voice state update',
          content: Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64'),
          ...(j.sha ? { sha: j.sha } : {}),
          branch: 'main'
        })
      });
      if (!r.ok) warn('[voice] فشل حفظ الحالة في GitHub:', r.status);
    } catch (e) {
      warn('[voice] فشل حفظ الحالة في GitHub:', e.message);
    }
  }

  async function load() {
    if (!ghToken || !ghRepo) return;
    try {
      const api = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${ghPath}`;
      const h = {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'bot-voice',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      const r = await fetch(api, { headers: h });
      if (!r.ok) return;
      const j = await r.json();
      if (!j.content) return;
      const obj = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
      if (obj && typeof obj === 'object') {
        state = { ...state, ...obj };
        saveLocal();
        log('[voice] تم تحميل حالة الروم من GitHub');
      }
    } catch (e) {
      warn('[voice] فشل قراءة الحالة من GitHub:', e.message);
    }
  }

  function join(guild, channel, actorTag) {
    if (!guild || !channel || !channel.isVoiceBased()) return false;
    const me = guild.members.me;
    if (me) {
      const perms = channel.permissionsFor(me);
      if (perms && (!perms.has(P.Connect) || !perms.has(P.Speak))) return false;
    }

    const existing = getVoiceConnection(guild.id);
    if (existing && existing.joinConfig.channelId === channel.id) {
      state[guild.id] = { channelId: channel.id, enabled: true };
      save();
      return true;
    }
    if (existing) existing.destroy();

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });
    connection.on('error', (err) => warn('[voice] خطأ اتصال صوتي:', err.message));

    state[guild.id] = { channelId: channel.id, enabled: true };
    save();
    log(`[voice] جالس في ${channel.name} / ${guild.name}${actorTag ? ' — ' + actorTag : ''}`);
    return true;
  }

  function leave(guild) {
    const connection = getVoiceConnection(guild.id);
    if (connection) connection.destroy();
    state[guild.id] = { channelId: null, enabled: false };
    save();
  }

  function commands() {
    return voiceCommandData;
  }

  async function handle(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    if (!['join', 'leave', 'status'].includes(interaction.commandName)) return false;

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ هذا الأمر يشتغل داخل سيرفر بس.', flags: 64 });
      return true;
    }

    if (interaction.commandName === 'join') {
      const option = interaction.options.getChannel('channel');
      const channel = option || interaction.member?.voice?.channel || null;
      if (!channel || !channel.isVoiceBased()) {
        await interaction.reply({ content: '❌ أدخل روم صوتي أول أو حدّد قناة بالأمر، ثم جرّب /join', flags: 64 });
        return true;
      }
      const ok = join(guild, channel, interaction.user.tag);
      await interaction.reply({
        content: ok
          ? `✅ البوت صار جالس في <#${channel.id}> — بيبقى فيه طول ما البوت شغال، ويرجع لحاله لو انقطع.`
          : '❌ ما قدر أدخل الروم — تأكد إن البوت عنده صلاحية Connect / Speak وأن الروم ليس ممتلئاً.',
        flags: 64
      });
      return true;
    }

    if (interaction.commandName === 'leave') {
      leave(guild);
      await interaction.reply({ content: '✅ طلعت من الروم الصوتي.', flags: 64 });
      return true;
    }

    if (interaction.commandName === 'status') {
      const connection = getVoiceConnection(guild.id);
      const chId = connection?.joinConfig?.channelId || state[guild.id]?.channelId;
      const ch = chId ? guild.channels.cache.get(chId) : null;
      await interaction.reply({
        content: ch
          ? `🔊 البوت جالس في <#${ch.id}> (${ch.name}) — محفوظ: ${state[guild.id]?.enabled ? 'نعم' : 'لا'}`
          : '🔇 البوت ما جالس في أي روم حالياً.',
        flags: 64
      });
      return true;
    }

    return false;
  }

  async function restore() {
    await load();
    for (const [gid, st] of Object.entries(state)) {
      if (!st.enabled || !st.channelId) continue;
      const guild = client.guilds.cache.get(gid);
      const ch = guild?.channels.cache.get(st.channelId);
      if (guild && ch && ch.isVoiceBased()) join(guild, ch);
    }
    log('[voice] تمت إعادة الأوتار المحفوظة');
  }

  function wire() {
    client.on('voiceStateUpdate', (oldState, newState) => {
      if (newState.member?.id !== client.user?.id) return;
      if (oldState.channelId && !newState.channelId) {
        const st = state[newState.guild.id];
        if (!st?.enabled || !st.channelId) return;
        setTimeout(() => {
          const guild = client.guilds.cache.get(newState.guild.id);
          const ch = guild?.channels.cache.get(st.channelId);
          if (guild && ch && ch.isVoiceBased()) join(guild, ch);
        }, 3000);
      }
    });
  }

  wire();

  return { commands, handle, restore, join, leave, state };
};
