'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const DEFAULTS = {
  supportRoleId: '',
  categoryId: '',
  logChannelId: '',
  ticketLimit: 1,
  color: '#5865F2',
  panelTitle: '🎫 نظام التذاكر',
  panelDescription:
    'اختر نوع طلبك من القائمة وبنفتح لك قناة خاصة بك أنت وفريق الدعم فقط.\n' +
    'ما تلقى نوعك؟ اختر **استفسار** واكتب كل شي تحت.',
  panelButtonLabel: 'اضغط لفتح تذكرة',
  ticketWelcomeTitle: '🎫 تذكرتك جاهزة',
  ticketWelcomeDescription:
    'اكتب تفاصيلك هنا، وأرفق أي صور أو ملفات تساعدنا نفهم طلبك.\nفريق الدعم بيوصلك قريب إن شاء الله.',
  mentionWarnHours: 24,
  mentionTimeoutHours: 3,
  mentionTimeoutEnabled: true,
  bannerFile: ''
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, ROOT };
  } catch (err) {
    console.warn('[!] تعذّر قراءة config.json — بنستخدم الإعدادات الافتراضية.');
    return { ...DEFAULTS, ROOT };
  }
}

const config = loadConfig();
config.defaults = DEFAULTS;

module.exports = config;
