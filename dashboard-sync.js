'use strict';

// يقرأ إعدادات البوت من لوحة التحكم كل ٣٠ ثانية ويطبّقها على الكائن الموجود
// بدون إعادة نشر — البوتات تستخدم نفس كائن config في كل الأحداث.

const DASHBOARD_URL = String(process.env.DASHBOARD_URL || '').trim().replace(/\/+$/, '');
const POLL_MS = Math.max(5000, Number(process.env.DASHBOARD_POLL_MS) || 30000);

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

async function start(botName, config, allowedKeys, onApply) {
  if (!DASHBOARD_URL) {
    console.log('[dashboard] DASHBOARD_URL غير مضبوط — الإعدادات محلية فقط');
    return null;
  }

  const url = `${DASHBOARD_URL}/api/settings/${botName}`;
  let lastHash = '';

  async function poll() {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const remote = await res.json();
      if (!remote || typeof remote !== 'object') return;

      const hash = JSON.stringify(remote);
      if (hash === lastHash) return;

      let changed = false;
      for (const key of allowedKeys) {
        if (!(key in remote)) continue;
        const value = remote[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key])) {
            config[key] = {};
          }
          deepMerge(config[key], value);
        } else {
          config[key] = value;
        }
        changed = true;
      }

      if (typeof onApply === 'function') onApply(remote, config);
      lastHash = hash;
      if (changed) console.log(`[dashboard] ✅ تم تطبيق إعدادات جديدة من اللوحة (${botName})`);
    } catch (err) {
      console.error('[dashboard] فشل جلب الإعدادات:', err.message);
    }
  }

  poll();
  const timer = setInterval(poll, POLL_MS);
  timer.unref();
  console.log(`[dashboard] مزامنة ${botName} كل ${POLL_MS / 1000} ثانية`);
  return timer;
}

module.exports = { start, deepMerge };
