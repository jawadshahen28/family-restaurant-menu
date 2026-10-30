import { loadEnvironment } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { seedData } from './seedData.js';
import { printDatabaseFailure } from '../src/config/connectionErrors.js';

let connection;
try {
  connection = await connectDatabase(loadEnvironment());
  const models = createModels(connection);
  await ensureIndexes(models);
  const counts = await seedData(models);
  console.log(JSON.stringify({ event: 'seed_completed', database: 'family_menu', ...counts }));
  console.log('تم إدخال البيانات الناقصة فقط. بقيت السجلات القائمة واختيارات المالك والطلبات دون تغيير.');
} catch (error) {
  if (error.name === 'DatabaseConnectionError') printDatabaseFailure(error);
  else console.error(error.message.startsWith('إعداد') || error.message.startsWith('CLIENT_ORIGIN') ? error.message : 'تعذّر إكمال إدخال البيانات الأولية. تحقق من الاتصال وإعدادات قاعدة family_menu.');
  process.exitCode = 1;
} finally { await connection?.close().catch(() => {}); }
