import { loadEnvironment } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createModels, ensureIndexes } from './models/index.js';
import { createRepository } from './services/repository.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

export async function startServer({ configuration = loadEnvironment, connect = connectDatabase, appFactory = createApp, modelFactory = createModels, indexer = ensureIndexes, log = logger } = {}) {
  const config = configuration();
  const connection = await connect(config);
  try {
    const models = modelFactory(connection);
    await indexer(models);
    const app = appFactory({ repository: createRepository(models), config, logger: log });
    const server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, '0.0.0.0', () => resolve(listener));
      listener.once('error', reject);
    });
    log.info('server_ready', { port: config.port, database: 'family_menu' });
    app.locals?.imageService?.start();
    const close = () => new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { server.closeAllConnections(); }, 10000);
      deadline.unref();
      server.close(async () => { clearTimeout(deadline); try { await app.locals?.imageService?.stop(); await connection.close(); resolve(); } catch { reject(new Error('تعذّر إغلاق اتصال قاعدة البيانات.')); } });
      server.closeIdleConnections();
    });
    return { server, close };
  } catch { await connection.close().catch(() => {}); throw new Error('تعذّر بدء الخادم أو تهيئة فهارس قاعدة البيانات. راجع الإعدادات والاتصال.'); }
}
