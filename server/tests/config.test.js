import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { validateEnvironment } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { startServer } from '../src/start.js';

const environment = { PORT: '5000', NODE_ENV: 'development', MONGODB_URI: 'mongodb+srv://family_menu:test%40encoded@cluster0.b5zqh3z.mongodb.net/family_menu?retryWrites=true&w=majority', CLIENT_ORIGIN: 'http://localhost:5173' };

test('MongoDB configuration accepts only the configured database, user, host and a real password', () => {
  const config = validateEnvironment(environment);
  assert.equal(config.databaseName, 'family_menu');
  assert.equal(config.port, 5000);
  assert.ok(config.allowedOrigins.includes('http://127.0.0.1:5173'));
  assert.ok(config.allowedOrigins.includes('http://localhost:5174'));
  for (const uri of [environment.MONGODB_URI.replace('test%40encoded', 'REPLACE_WITH_PASSWORD'), environment.MONGODB_URI.replace('/family_menu?', '/another_database?'), environment.MONGODB_URI.replace('family_menu:', 'other_user:'), environment.MONGODB_URI.replace('cluster0.b5zqh3z', 'other'), environment.MONGODB_URI.replace('b5zqh3z', 'b5zgh3z'), 'mongodb://localhost/family_menu']) {
    assert.throws(() => validateEnvironment({ ...environment, MONGODB_URI: uri }));
  }
  assert.throws(() => validateEnvironment({ ...environment, MONGODB_URI: '' }));
  assert.throws(() => validateEnvironment({ ...environment, CLIENT_ORIGIN: '*' }));
  assert.throws(() => validateEnvironment({ ...environment, NODE_ENV: 'production' }));
  assert.throws(() => validateEnvironment({ ...environment, PORT: 'bad' }));
});

test('production environment uses only CLIENT_ORIGIN even if development origins are configured', () => {
  const config = validateEnvironment({ ...environment, NODE_ENV: 'production', CLIENT_ORIGIN: 'https://menu.example.com', DEV_CLIENT_ORIGINS: 'http://menu.local:5174', DEV_CLIENT_PORTS: '5173,5174' });
  assert.deepEqual(config.allowedOrigins, ['https://menu.example.com']);
});

test('frontend hosting is opt-in and accepts only explicit boolean settings', () => {
  assert.equal(validateEnvironment(environment).serveFrontend, false);
  assert.equal(validateEnvironment({ ...environment, SERVE_FRONTEND: 'true' }).serveFrontend, true);
  assert.throws(() => validateEnvironment({ ...environment, SERVE_FRONTEND: 'yes' }));
});

test('connection failure is clear and cannot expose driver credentials', async () => {
  const secret = 'mongodb+srv://private-user:private-password@private-host/';
  await assert.rejects(connectDatabase(validateEnvironment(environment), { connect: async () => { throw new Error(secret); } }), (error) => {
    assert.match(error.message, /تعذّر الاتصال/);
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});

test('server connects and establishes indexes before listening; shutdown closes both', async () => {
  const events = [];
  const connection = { close: async () => events.push('db_closed') };
  const listener = new EventEmitter();
  listener.close = (callback) => { events.push('http_closed'); callback(); };
  listener.closeIdleConnections = () => {};
  listener.closeAllConnections = () => {};
  const result = await startServer({
    configuration: () => ({ port: 5000 }), connect: async () => { events.push('connected'); return connection; },
    modelFactory: () => ({}), indexer: async () => events.push('indexes'),
    appFactory: () => ({ listen(port, host, callback) { events.push('listening'); queueMicrotask(callback); return listener; } }),
    log: { info() {} },
  });
  assert.deepEqual(events, ['connected', 'indexes', 'listening']);
  await result.close();
  assert.deepEqual(events.slice(-2), ['http_closed', 'db_closed']);
});

test('a failed database connection never opens an HTTP listener', async () => {
  let listening = false;
  await assert.rejects(startServer({ configuration: () => ({}), connect: async () => { throw new Error('connection failed'); }, appFactory: () => { listening = true; } }));
  assert.equal(listening, false);
});
