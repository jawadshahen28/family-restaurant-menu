import mongoose from 'mongoose';
import { loadEnvironment } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { printDatabaseFailure } from '../src/config/connectionErrors.js';

try {
  const connection = await connectDatabase(loadEnvironment());
  await connection.db.command({ ping: 1 });
  console.log(JSON.stringify({ event: 'database_connection_verified', database: 'family_menu', ping: 'ok', readOnlyCheck: true }));
} catch (error) {
  if (error.name === 'DatabaseConnectionError') printDatabaseFailure(error);
  else console.error(error.message.startsWith('إعداد') || error.message.startsWith('CLIENT_ORIGIN') ? error.message : 'تعذّر إكمال فحص الاتصال بقاعدة family_menu.');
  process.exitCode = 1;
} finally { await mongoose.disconnect().catch(() => {}); }
