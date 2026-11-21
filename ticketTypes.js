'use strict';

/* أنواع التذاكر اللي تظهر في القائمة بعد ضغط زر «افتح تذكرة» */

const TICKET_TYPES = {
  purchase: {
    label: 'شراء من متجر',
    emoji: '🛒',
    short: 'طلب منتجات وعمليات الشراء',
    description: 'طلب منتجات، أسعار، وعمليات الشراء',
    color: '#57F287',
    prefix: 'purchase',
    title: 'تذكرة شراء من المتجر',
    intro: 'أهلاً بك 👋 اكتب طلبك بالتفصيل وفريق المتجر بيرجع لك بأقرب وقت.',
    questions: [
      'اسم المنتج أو الرابط',
      'الكمية المطلوبة',
      'أي تفاصيل إضافية (مقاس / لون / ملاحظات)'
    ]
  },

  inquiry: {
    label: 'استفسار',
    emoji: '❓',
    short: 'أسئلة واستفسارات عامة',
    description: 'اسأل أي شي عن السيرفر أو الخدمات',
    color: '#5865F2',
    prefix: 'inquiry',
    title: 'تذكرة استفسار',
    intro: 'أهلاً بك 👋 اكتب استفسارك وفريق الدعم بيجاوبك.',
    questions: ['وش تبي تستفسر عنه؟', 'أي معلومات عندك مسبقاً؟']
  },

  problem: {
    label: 'حل مشكلة',
    emoji: '🛠️',
    short: 'بلّغ عن مشكلة واطلب المساعدة',
    description: 'عطل، خطأ، أو أي مشكلة تحتاج حل',
    color: '#ED4245',
    prefix: 'problem',
    title: 'تذكرة حل مشكلة',
    intro: 'أهلاً بك 👋 اشرح المشكلة بدقة عشان نقدر نساعدك أسرع.',
    questions: [
      'وش المشكلة؟ ومتى صارت؟',
      'الخطوات اللي سويتها قبل ما تصير',
      'صورة أو سجل إن كان فيه'
    ]
  }
};

function getType(key) {
  return TICKET_TYPES[key] || null;
}

function options() {
  return Object.entries(TICKET_TYPES).map(([key, type]) => ({ ...type, key }));
}

module.exports = { TICKET_TYPES, getType, options };
