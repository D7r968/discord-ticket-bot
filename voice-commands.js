'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const adminOnly = (c) => c.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON();

module.exports = [
  adminOnly(new SlashCommandBuilder()
    .setName('join')
    .setDescription('أدخل البوت في الروم الصوتي وخليه جالس فيه')
    .addChannelOption((o) => o.setName('channel').setDescription('القناة الصوتية (اتركها فاضية عشان يدخل رومك أنت)').setRequired(false))),
  adminOnly(new SlashCommandBuilder()
    .setName('leave')
    .setDescription('أخرج البوت من الروم الصوتي')),
  adminOnly(new SlashCommandBuilder()
    .setName('status')
    .setDescription('اعرض حالة البوت في الروم الصوتي'))
];
