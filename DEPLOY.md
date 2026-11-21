# 🚀 نشر البوت 24/7 على استضافة

الملفات جاهزة لكل الاستضافات المشهورة. **المهم: ما ترفع ملف `.env` أبداً** — التوكن يتحط كـ Environment Variables في لوحة الاستضافة.

> بسبب إن جهازك ما فيه Git/Docker ولا CLI لاستضافة، ما أقدر أدخل حسابك من هنا. اختر استضافة من تحت واتبع الخطوات، أو أعطيني بيانات الدخول/ VPS وأسويها عنك.

---

## 🔐 المتغيرات المطلوبة في كل استضافة

| الاسم | القيمة |
|---|---|
| `DISCORD_TOKEN` | توكن البوت من Discord Developer Portal |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | آي_دي السيرفر (اتركه فاضي إذا تبي الأوامر عالمية) |
| `PORT` | `3000` (الفلاي والريندر يضيفونه تلقائياً) |

---

## ٠) تم بالفعل: تشغيل تلقائي على جهازك (مجاني 100%)

- أُنشئت مهمة **Discord Ticket Bot** في **Task Scheduler** تشتغل عند كل إقلاع للويندوز بحساب `SYSTEM` (قبل أي دخول، وبونافذة).
- ملف `run-forever.bat` يعيد تشغيل البوت تلقائياً خلال ٥ ثواني إذا انقطع (اختبرناه 👍).
- عطّلنا النوم/السبات عند توصيل الكهرباء (`powercfg`) عشان البوت ما يوقف.
- البوت الحين متصل بـ gateway ديسكورد (تحقق من الاتصال).
- **الحد الوحيد:** إذا الجهاز مطفي أو الانترنت مقطوع، البوت يوقف. عشان 24/7 حقيقي بغض النظر عن جهازك، لازم سحابة (الخيارات تحت).

إلغاء التشغيل التلقائي (كأدمن): `schtasks /delete /tn "Discord Ticket Bot" /f`

---

## ١) Render (أسهل، مجاني)

1. افتح https://github.com وسوي **New repository** (خاص أو عام) وسمّيه `discord-ticket-bot`.
2. ارفع كل ملفات المشروع **عدا** `.env` و `node_modules` و `data.json` و `transcripts`.
   - أسرع طريقة: استخرج `discord-ticket-bot-deploy.zip` الموجود على سطح المكتب واسحب الملفات للـ repo.
3. في Render: **New → Web Service** → اربط الـ repo.
   - ملف `render.yaml` موجود فبيتعرف عليه تلقائياً.
   - أو أدخل يدوياً: `Build Command: npm ci --omit=dev` / `Start Command: node index.js`.
4. في **Environment** أضف `DISCORD_TOKEN` و `CLIENT_ID` و `GUILD_ID`.
5. **Create Web Service** → بيشتغل البوت.

⚠️ الخطة المجانية في Render بترقد بعد 15 دقيقة بدون زيارة. عشان يبقى شغال:
- سجّل في https://uptimerobot.com وضيف Monitor من نوع HTTP/HTTPS على رابط البوت، وخلّي الفحص كل 5 دقائق (الصفحة `/` ترجع `{"status":"ok"}`)، **أو**
- استخدم Background Worker مدفوع / خطة Starter.

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
