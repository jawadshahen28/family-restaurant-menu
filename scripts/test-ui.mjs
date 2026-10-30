import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../server/src/models/index.js';
import { createRepository } from '../server/src/services/repository.js';
import { createApp } from '../server/src/app.js';

// Own the Vite server directly so Windows cleanup does not need process-tree utilities.
let server;
let mongo;
let connection;
let apiServer;
try {
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu' } });
  const testUri = mongo.getUri();
  connection = await mongoose.createConnection(testUri, { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
  const models = createModels(connection);
  await ensureIndexes(models);
  const testConfig = { allowedOrigins: [], trustProxy: 0 };
  const api = createApp({ repository: createRepository(models), config: testConfig, logger: { info() {}, error() {} }, limiter: { orders: 10000, confirmations: 10000 } });
  apiServer = await new Promise((resolve, reject) => { const listener = api.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject); });
  const apiURL = `http://127.0.0.1:${apiServer.address().port}`;
  server = await createServer({ define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') }, server: { host: '127.0.0.1', port: 5179, strictPort: false, proxy: { '/api': { target: apiURL, changeOrigin: true } } } });
  await server.listen();
  testConfig.allowedOrigins.push(new URL(server.resolvedUrls.local[0]).origin);
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true, env: { ...process.env, FAMILY_TEST_MONGO_URI: testUri, FAMILY_TEST_BASE_URL: server.resolvedUrls.local[0] } });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await server?.close();
  if (apiServer) await new Promise((resolve) => { apiServer.close(resolve); apiServer.closeAllConnections(); });
  await connection?.close();
  await mongo?.stop();
}
