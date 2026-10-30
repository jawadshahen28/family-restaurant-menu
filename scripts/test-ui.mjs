import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import { X509Certificate, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
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
let tlsDirectory;
const production = process.argv.includes('--production');
try {
  let tls;
  let tlsSpki = '';
  if (production) {
    // Deliberately conflicting legacy setting: the unified build must override it.
    process.env.SERVE_FRONTEND = 'true';
    process.env.VITE_API_BASE_URL = 'https://wrong-api.invalid';
    await build();
    fs.mkdirSync(path.resolve('.cache'), { recursive: true });
    tlsDirectory = fs.mkdtempSync(path.resolve('.cache/production-tls-'));
    const key = path.join(tlsDirectory, 'localhost.key');
    const cert = path.join(tlsDirectory, 'localhost.crt');
    const gitOpenSsl = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe');
    const openssl = process.env.OPENSSL_BIN || (process.platform === 'win32' && fs.existsSync(gitOpenSsl) ? gitOpenSsl : 'openssl');
    const generated = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { windowsHide: true, stdio: 'ignore' });
    if (generated.status !== 0) throw new Error('Production browser tests require OpenSSL (or OPENSSL_BIN) to create a disposable local TLS certificate.');
    tls = { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
    const publicKey = new X509Certificate(tls.cert).publicKey.export({ type: 'spki', format: 'der' });
    tlsSpki = createHash('sha256').update(publicKey).digest('base64');
  }
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu' } });
  const testUri = mongo.getUri();
  connection = await mongoose.createConnection(testUri, { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
  const models = createModels(connection);
  await ensureIndexes(models);
  const testConfig = { allowedOrigins: [], trustProxy: production ? 1 : 0, nodeEnv: production ? 'production' : 'test', serveFrontend: production };
  const api = createApp({ repository: createRepository(models), config: testConfig, logger: { info() {}, error() {} }, limiter: { orders: 10000, confirmations: 10000, adminLogin: 10000 } });
  apiServer = await new Promise((resolve, reject) => {
    const listener = production ? https.createServer(tls, api).listen(0, '127.0.0.1', () => resolve(listener)) : api.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const apiURL = `${production ? 'https' : 'http'}://127.0.0.1:${apiServer.address().port}`;
  let baseURL = apiURL;
  if (!production) {
    server = await createServer({ define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') }, server: { host: '127.0.0.1', port: 5179, strictPort: false, proxy: { '/api': { target: apiURL, changeOrigin: true }, '/uploads': { target: apiURL, changeOrigin: true } } } });
    await server.listen();
    baseURL = server.resolvedUrls.local[0];
  }
  testConfig.allowedOrigins.push(new URL(baseURL).origin);
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2).filter(argument => argument !== '--production')], { stdio: 'inherit', windowsHide: true, env: { ...process.env, FAMILY_TEST_MONGO_URI: testUri, FAMILY_TEST_BASE_URL: baseURL, FAMILY_TEST_PRODUCTION: production ? 'true' : 'false', FAMILY_TEST_TLS_SPKI: tlsSpki } });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await server?.close();
  if (apiServer) await new Promise((resolve) => { apiServer.close(resolve); apiServer.closeAllConnections(); });
  await connection?.close();
  await mongo?.stop();
  if (tlsDirectory) {
    for (const name of ['localhost.key', 'localhost.crt']) fs.rmSync(path.join(tlsDirectory, name), { force: true });
    fs.rmdirSync(tlsDirectory);
  }
}
