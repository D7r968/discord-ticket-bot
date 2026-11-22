'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('أدخل البوت في الروم الصوتي وخليه جالس فيه')
    .addChannelOption((o) => o.setName('channel').setDescription('القناة الصوتية (اتركها فاضية عشان يدخل رومك أنت)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('أخرج البوت من الروم الصوتي'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('اعرض حالة البوت في الروم الصوتي')
].map((c) => c.toJSON());
