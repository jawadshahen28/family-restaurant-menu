# مطعم ومطبخ العائلة — Family Restaurant & Kitchen 🍗

نظام متكامل لإدارة وطلب وجبات مطعم ومطبخ العائلة بواجهة عربية كاملة (RTL)، مصمم خصيصاً لتوفير تجربة استثنائية للزبائن على الويب، وتجربة تحكم وإدارة دقيقة ومرنة لأصحاب المطعم على هواتف iPhone وأجهزة iPad (بما في ذلك دعم PWA وتثبيت التطبيق على الشاشة الرئيسية وإشعارات Web Push الفورية).

---

## 🛠 التقنيات المستخدمة (Tech Stack)

### الواجهة الأمامية (Frontend)
- **React 19 + Vite**: أداء فائق وسرعة استجابة.
- **Tailwind CSS v4**: تصميم حديث متجاوب للهواتف والأجهزة اللوحية والمكتبية.
- **Arabic RTL & Cairo Font**: تجربة مستخدم عربية أصيلة مع خط Cairo المستضاف محلياً.
- **Progressive Web App (PWA)**: مشغّل خدمة (Service Worker) وبيان ويب قياسي (`manifest.webmanifest`) قابل للتثبيت كبرنامج مستقل على شاشات iPhone و iPad.

### الخادم وقاعدة البيانات (Backend & Database)
- **Node.js + Express 5**: واجهات REST API سريعة وآمنة.
- **MongoDB Atlas + Mongoose 9**: تخزين مرن وموثوق للبيانات مع فهارس فريدة ومعاملات ذرية.
- **Web Push (VAPID)**: إشعارات فورية متوافقة مع معايير Apple Web Push و Google FCM عبر مكتبة `web-push`.
- **Durable Outbox Queue**: طابور مهام إشعارات دائم وموثوق في MongoDB لضمان عدم ضياع التنبيهات وعدم تأخير أو تعطيل طلبات الزبائن.
- **Security & Session Management**: جلسات عبر كوكيز `httpOnly` المشفرة، حماية من هجمات CSRF، تحديد معدل الطلبات (Rate Limiting)، ترويسات أمان (Helmet)، وتقييد الوصول (CORS).

---

## 📱 المميزات الرئيسية للنظام

1. **قائمة الطعام وسلة المشتريات للزبائن:**
   - تصفح الأصناف حسب الفئات، إضافة للسلّة، تحديد خيارات الاستلام (استلام من المطعم / خدمة التوصيل).
   - التحقق الصارم من صحة أرقام الهواتف والأسعار على الخادم مباشرة.
   - تقديم طلبات حقيقية وحفظها في MongoDB مع رمز وصول فريد وآمن لكل طلب.

2. **لوحة تحكم المشرف (Admin Dashboard):**
   - تسجيل دخول آمن للمالك محمي من التخمين وجلسات تدعم التجديد والإلغاء.
   - **إدارة الفئات والأصناف:** إضافة، تعديل، إيقاف، حذف مع حماية الأصناف المرتبطة بعروض نشطة، ورفع الصور محلياً أو سحابياً.
   - **إدارة العروض الخاصة:** عروض محدودة بمدى زمني محدد وتحديث تلقائي لأسعار الوجبات في السلة.
   - **إعدادات المتجر:** مفتاح الإغلاق/الفتح الرئيسي للمطعم، تفعيل/تعطيل التوصيل أو الاستلام، وإعلانات الزبائن.
   - **إدارة الطلبات الفورية (3 حالات فقط):**
     - المسار الإلزامي: `جديد (new) → تم استلام الطلب (received) → تم التجهيز (prepared)`.
     - تحديثات دورية خفيفة (Polling) كل 7 ثوانٍ مع تنبيه صوتي وبصري للطلبات الجديدة دون استهلاك الموارد.

3. **تطبيق PWA وإشعارات الدفع (Web Push):**
   - تثبيت لوحة الإدارة على الشاشة الرئيسية (Add to Home Screen) على أجهزة iPhone و iPad بنمط `standalone`.
   - إشعار فوري عند وصول أي طلب جديد للمطعم حتى لو كان التطبيق مغلقاً.
   - دعم اشتراك أجهزة متعددة للمالك في نفس الوقت (مثلاً هاتف iPhone وجهاز iPad).
   - تنظيف ذاتي وحذف فوري للاشتراكات المنتهية عند ورود استجابة `410 Gone`.

---

## 📁 هيكلية المشروع (Project Structure)

```
MENU/
├── public/                     # الملفات الثابتة للواجهة (أيقونات PWA، صور الوجبات، البيان)
│   ├── icons/                  # أيقونات التطبيق بأحجام 192 و 512 و Maskable و Apple
│   ├── images/                 # صور وجبات المنيو والشعار الرسمي
│   ├── uploads/                # مجلد رفع الصور المحلي للواجهة (مستثنى من Git)
│   ├── manifest.webmanifest    # بيان تطبيق الويب PWA
│   └── sw.js                   # مشغل الخدمة (Service Worker) لإشعارات الويب
├── scripts/                    # سكربتات مساعدة للبناء والاختبار
│   ├── generate-icons.mjs      # سكربت توليد أيقونات PWA
│   └── test-ui.mjs             # مشغل اختبارات Playwright للمتصفح
├── server/                     # كود الخادم الخلفي (Backend)
│   ├── public/uploads/         # مجلد حفظ الصور المرفوعة محلياً (مستثنى من Git)
│   ├── scripts/                # سكربتات قاعدة البيانات
│   │   ├── check-db.js         # فحص الاتصال بقاعدة بيانات Atlas
│   │   ├── create-admin.js     # إنشاء حساب مشرف جديد
│   │   ├── generate-vapid-keys.js # توليد مفاتيح VAPID للإشعارات
│   │   ├── migrateOrderStatus.js  # ترقية حالات الطلبات القديمة
│   │   └── seed.js             # إدخال بيانات الأصناف والفئات الأولية
│   ├── src/
│   │   ├── config/             # إعدادات البيئة، الاتصال بقاعدة البيانات، و CORS
│   │   ├── models/             # نماذج Mongoose (Orders, Products, Categories, Admin, etc.)
│   │   ├── services/           # منطق العمليات (الطلبات، المصادقة، الإشعارات، التخزين)
│   │   ├── utils/              # دوال التشفير، الكوكيز، والمعالجة
│   │   ├── validators/         # مخططات Zod الصارمة للتحقق من المدخلات
│   │   ├── app.js              # إعداد مسارات Express وتطبيق الأمان
│   │   ├── index.js            # نقطة الدخول الرئيسية للخادم
│   │   └── start.js            # إدارة دورة حياة الخادم والاتصال
│   ├── tests/                  # اختبارات الخادم والتكامل
│   ├── .env.example            # قالب متغيرات البيئة للخادم
│   └── package.json            # اعتماديات الخادم
├── src/                        # كود الواجهة الأمامية (Frontend React)
│   ├── assets/                 # شعار المطعم الأصلي
│   ├── components/             # مكونات React (السلة، المنيو، لوحة الإدارة، التصاميم)
│   ├── context/                # سياقات إدارة الحالة (Cart, Menu, AdminAuth)
│   ├── pages/                  # صفحات التطبيق (الزبائن ولوحة المشرف)
│   ├── services/               # عملاء استدعاء الـ API
│   ├── styles/                 # تنسيقات CSS و Tailwind
│   └── utils/                  # دوال التنسيق والتحقق
├── tests/                      # اختبارات الواجهة الأمامية والمتصفح (Playwright)
├── .env.example                # قالب متغيرات البيئة للواجهة
├── .gitignore                  # الملفات المستثناة من مستودع Git
├── package.json                # اعتماديات وسكربتات المشروع الجذرية
└── vite.config.js              # إعدادات Vite وممررات الـ Proxy
```

---

## Local development

Use Node.js 22.12 or later and npm. The root npm workspace installs both the frontend and backend from the root lockfile.

Install the exact locked dependencies from the repository root:

```bash
npm ci
```

Create local environment files only when they do not already exist. In PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Fill in backend configuration privately. The database placeholder is intentionally unusable: supply the existing authorized connection string that satisfies the backend's database validation. Keep existing database settings and VAPID keys. Never put backend credentials in frontend variables or browser bundles.

```bash
npm run dev
```

This runs Vite and Express together. The customer app is available at http://localhost:5173 and the admin dashboard at http://localhost:5173/admin. Vite proxies API and uploaded-image requests to Express.

| Command | Purpose |
| --- | --- |
| `npm run dev:client` | Run the Vite development server. |
| `npm run dev:server` | Run Express with Node watch mode. |
| `npm run build` | Build the frontend into `dist/`. |
| `npm run preview` | Preview the built frontend; this does not start or proxy the API. |
| `npm run start:server` | Start Express using the private backend environment. |
| `npm run test:production` | Build and run the full browser suite against isolated HTTPS production-mode hosting. |

Database seed, migration, admin-creation, and VAPID-generation scripts are maintenance tools, not installation steps for an existing restaurant. Do not run them against an existing database without a separate, explicit maintenance decision.

## Environment variable names

The table lists names and roles only. Safe defaults and blank placeholders are in the two `.env.example` files. Actual credentials belong in ignored local files or private hosting settings.

| Scope | Names | Purpose |
| --- | --- | --- |
| Backend, required | `MONGODB_URI`, `CLIENT_ORIGIN` | Authorized database connection and allowed frontend origin(s). |
| Backend runtime | `PORT`, `NODE_ENV`, `TRUST_PROXY`, `SERVE_FRONTEND` | Listener, runtime mode, reverse-proxy configuration, and optional same-origin frontend hosting. |
| Backend development | `DEV_CLIENT_PORTS`, `DEV_ALLOW_LAN`, `DEV_CLIENT_ORIGINS` | Development-only origin handling. |
| Backend Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Existing Web Push credentials and contact subject. |
| Backend image storage | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required for production uploads; local fallback is development-only. |
| Frontend build | `VITE_API_BASE_URL` | Public API base URL; exposed in the browser bundle. |
| Vite development | `API_PROXY_TARGET` | Backend target used by the development proxy. |

## Tests and verification

```bash
npm test
npm run test:server
npm run test:ui
npm run build
```

The first command runs frontend unit tests and backend integration tests. The server-only command is an optional narrower run. Integration and browser tests create isolated MongoMemoryServer instances and do not use the production database. The first test run may download a MongoDB test binary into the ignored `.cache/` directory.

Browser tests use Playwright with an installed Google Chrome browser. The UI test runner starts its own local API, test database, and Vite server. Reports, screenshots, downloaded binaries, and build outputs remain outside Git.

## Render deployment preparation

The recommended production setup is one Node web service serving the Vite build, API, and uploads from the same origin. Set `SERVE_FRONTEND` to enable frontend hosting; the default remains API-only for local development and existing API deployments. The build directory is resolved from the module location, independently of npm's workspace working directory.

See [the exact Render configuration and authentication verification steps](docs/render-authentication.md). Use the repository root: a backend validator imports a shared phone-validation utility from root `src/`. The root lockfile also covers both npm workspaces. Build dependencies must be installed even when the runtime environment is production.

Admin requests always target the page's own `/api` routes, use HttpOnly same-origin session cookies, and retain CSRF validation. Login verifies `/api/admin/me` before setting authenticated UI state. Unified builds force the public API base to the same origin, even if a stale separate-backend build setting remains. Sessions and CSRF tokens are not stored in localStorage.

See [durable image uploads and synchronization](docs/image-uploads.md). Production uploads use Cloudinary and persist versioned URLs and public IDs. Missing or failing provider settings produce an error instead of ephemeral local uploads. Development without Cloudinary retains `public/uploads` relative to the API process working directory. Source code and `.gitkeep` files do not contain previously uploaded media.

Production browser tests require Chrome and OpenSSL (`OPENSSL_BIN` can select its executable). They generate and remove a disposable local TLS certificate, use a fresh MongoMemoryServer, and run the compiled app without Vite's development proxy. Only that test browser accepts the local self-signed certificate. No production database or credentials are used. These changes do not create services, change Atlas, or deploy the application.

## Security and local data

Commit source, tests, package files and lockfiles, safe environment examples, the restaurant logo, static menu images, and PWA icons. Keep actual environment files, private keys and certificates, credentials, dependencies, build output, provider metadata, reports, caches, logs, temporary files, database exports, and runtime image uploads outside Git.

The `.gitkeep` files preserve empty upload directories. Ignoring uploads does not disable the existing upload feature. Adding an ignore rule does not remove anything already committed: inspect both the exact upload snapshot and Git history for secrets before publishing.
