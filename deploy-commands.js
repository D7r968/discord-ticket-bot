'use strict';

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commandData } = require('./commands');

const token = String(process.env.DISCORD_TOKEN || '').trim();
const clientId = String(process.env.CLIENT_ID || '').trim();
const guildId = String(process.env.GUILD_ID || '').trim();

if (!token || !clientId) {
  console.error('❌ لازم تحط DISCORD_TOKEN و CLIENT_ID في ملف .env أول.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(`✅ تم تسجيل الأوامر في السيرفر ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log('✅ تم تسجيل الأوامر عالمياً (تحتاج دقائق عشان تظهر)');
    }
  } catch (err) {
    console.error('❌ فشل التسجيل:', err);
    process.exit(1);
  }
})();
