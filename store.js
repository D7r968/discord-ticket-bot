'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');

function emptyData() {
  return { counter: 0, tickets: {} };
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      counter: Number(parsed.counter) || 0,
      tickets: parsed.tickets && typeof parsed.tickets === 'object' ? parsed.tickets : {}
    };
  } catch {
    return emptyData();
  }
}

let data = load();

function save() {
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[!] فشل حفظ data.json:', err.message);
  }
}

function nextNumber() {
  data.counter += 1;
  save();
  return data.counter;
}

function addTicket(channelId, info) {
  data.tickets[channelId] = info;
  save();
}

function getTicket(channelId) {
  return data.tickets[channelId] || null;
}

function removeTicket(channelId) {
  if (data.tickets[channelId]) {
    delete data.tickets[channelId];
    save();
  }
}

function findOpenTicket(guildId, userId) {
  for (const [channelId, ticket] of Object.entries(data.tickets)) {
    if (ticket.guildId === guildId && ticket.ownerId === userId) {
      return { channelId, ticket };
    }
  }
  return null;
}

function countOpenByUser(guildId, userId) {
  return Object.values(data.tickets).filter(
    (t) => t.guildId === guildId && t.ownerId === userId
  ).length;
}

function allTickets() {
  return data.tickets;
}

module.exports = {
  nextNumber,
  addTicket,
  getTicket,
  removeTicket,
  findOpenTicket,
  countOpenByUser,
  allTickets
};
