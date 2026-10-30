import { startServer } from './start.js';

try {
  const { close } = await startServer();
  let shuttingDown = false;
  const shutdown = async () => { if (shuttingDown) return; shuttingDown = true; try { await close(); } catch { console.error('تعذّر إغلاق جميع الاتصالات بشكل طبيعي.'); process.exitCode = 1; } };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  // These startup errors are deliberately sanitized; never log driver errors or URIs.
  const safe = /^(إعدادات الخادم|إعداد MongoDB|CLIENT_ORIGIN|تعذّر الاتصال بقاعدة family_menu|تعذّر بدء الخادم أو تهيئة)/.test(error.message);
  console.error(safe ? error.message : 'تعذّر بدء الخادم. تحقق من الإعدادات والاتصال بقاعدة family_menu.');
  process.exitCode = 1;
}
