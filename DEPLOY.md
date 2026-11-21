# 🚀 نشر البوت 24/7 على استضافة

الملفات جاهزة لكل الاستضافات المشهورة. **المهم: ما ترفع ملف `.env` أبداً** — التوكن يتحط كـ Environment Variables في لوحة الاستضافة.

> ✅ **البوت منشور فعلياً على Render (مجاني بدون بطاقة) وهو شغال 24/7.** التفاصيل تحت.

---

## 🔐 المتغيرات المطلوبة في كل استضافة

| الاسم | القيمة |
|---|---|
| `DISCORD_TOKEN` | توكن البوت من Discord Developer Portal |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | آي_دي السيرفر (اتركه فاضي إذا تبي الأوامر عالمية) |
| `PORT` | `3000` (الفلاي والريندر يضيفونه تلقائياً) |

---

## ٠) النشر الحالي (تم تنفيذه ✅)

| العنصر | القيمة |
|---|---|
| الاستضافة | **Render** — Web Service، خطة `free`، منطقة **virginia** |
| الرابط | https://discord-ticket-bot-v2-3uzx.onrender.com |
| لوحة التحكم | https://dashboard.render.com/web/srv-dc0qicuc6qcc73f5m0tg |
| GitHub | https://github.com/D7r968/discord-ticket-bot |
| Build / Start | `npm ci --omit=dev` / `node index.js` |
| المتغيرات | `DISCORD_TOKEN` + `NODE_ENV=production` (بدون رفع `.env`) |
| حالة الدخول | `bot:"Ticket 971#1742"`، `login:"logged_in"`، `ws:"open"` |

**ملاحظة مهمة عن المنطقة:** منطقة `oregon` كانت ترجع `429` من `discord.com/api/v10/gateway/bot` فكان الدخول يعلّق. نقلنا الخدمة لـ `virginia` واشتغل من أول مرة. لا ترجّعها لأوريغون.

تم كمان:
- حذف خدمة Oregon القديمة (`srv-dc0qct61egvs738o7co0`) عشان ما يصير فيه نسختين.
- **إيقاف التشغيل التلقائي المحلي**: حُذفت مهمة `Discord Ticket Bot` من Task Scheduler وquery killed للعملية المحلية — البوت الآن نسخة واحدة بس (السحابة).

### ✅ البينغ كل ٥ دقائق (مفعّل الآن)
الخطة المجانية في Render ترقد بعد ١٥ دقيقة بدون زيارة. الملف `.github/workflows/keep-alive.yml` **مرفوع ومفعّل** في GitHub Actions (الاسم: `Keep bot awake`)، ويرسل طلب GET كل ٥ دقائق للرابط أعلاه. تم تجربة تشغيله يدوياً ونجح ✅.

فحص الحالة اليدوي:
```powershell
Invoke-RestMethod https://discord-ticket-bot-v2-3uzx.onrender.com/
```

---

## ٢) Railway (سريع، $5 تجريبي ثم مدفوع)

1. https://railway.app → سجّل الدخول بجيثب → **New Project → Deploy from GitHub repo**.
2. اختار الـ repo اللي رفعته.
3. تبويب **Variables** → أضف `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
4. Railway بيقرأ `railway.json` ويشغّل `node index.js` تلقائياً.
5. تبويب **Logs** تأكد يطلع `[✓] تم تسجيل الدخول`.

أو من جهازك بعد تثبيت Railway CLI:
```powershell
railway login
railway init
railway up
railway variables set DISCORD_TOKEN=xxxx CLIENT_ID=xxxx GUILD_ID=xxxx
```

---

## ٣) Fly.io (مجاني بمحدودية + بطاقة)

```powershell
# ثبّت flyctl من https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy      # وافق على fly.toml الموجود
fly secrets set DISCORD_TOKEN=xxxx CLIENT_ID=xxxx GUILD_ID=xxxx
fly deploy
fly logs
```

`fly.toml` مضبوط بـ `min_machines_running = 1` عشان ما يوقف.

---

## ٤) VPS مجاني دائم (Oracle Cloud Always Free) — الأفضل لـ 24/7 مجاناً

1. سوي حساب في https://oracle.com/cloud/free واضيف VM (Ampere A1، Ubuntu 24.04).
2. افتح المنافذ واتصل بالسيرفر:
   ```bash
   ssh ubuntu@IP_NUMBER
   sudo apt update && sudo apt install -y nodejs npm
   ```
3. انقل الملفات (من جهازك بـ PowerShell):
   ```powershell
   scp -r .\discord-ticket-bot-deploy\* ubuntu@IP_NUMBER:/home/ubuntu/ticket-bot
   ```
4. على السيرفر:
   ```bash
   cd /home/ubuntu/ticket-bot
   npm ci --omit=dev
   sudo npm i -g pm2
   cp .env.example .env && nano .env     # حط التوكن
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup                            # ينفّذ الأمر اللي يطلع عشان يشتغل بعد كل إعادة تشغيل
   ```
5. بدال PM2 تقدر تستخدم ملف `deploy/ticket-bot.service` مع systemd.

---

## ✅ بعد النشر

- البوت لازم يطلع **Online** في السيرفر.
- جرّب `/setup channel:#الدعم`، وبعدين اضغط الزر وجرّب المنشن.
- إذا ما ظهرت الأوامر فوراً: الأوامر عالمية وقد تحتاج دقائق — أو حط `GUILD_ID` عشان تظهر مباشرة.

## 🛡️ تنبيه أمني

- ما تشارك التوكن ولا ترفع `.env` لأي repo/موقع.
- إذا انكشف التوكن: ارجع لـ Developer Portal واضغط **Reset Token** وحدّث المتغير عند الاستضافة.

---

قل لي أي استضافة تبيها وأكمّل معاك خطوة بخطوة، أو إذا عندك VPS/SSH أعطيني البيانات وأنا أركّبه لك.
