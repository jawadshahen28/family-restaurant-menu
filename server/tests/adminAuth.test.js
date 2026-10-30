import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/utils/auth.js';
import { parseCookies, ADMIN_SESSION_COOKIE } from '../src/utils/cookies.js';

let mongo, connection, models, repository, app;
const config = { allowedOrigins: ['http://localhost:5173'], trustProxy: 0, nodeEnv: 'test' };
const logEntries = [];
const logger = { info(event, fields) { logEntries.push({ event, fields }); }, error(event, fields) { logEntries.push({ event, fields }); } };
const makeApp = (options = {}) => createApp({ repository, config, logger, limiter: { adminLogin: 100 }, ...options });

before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu' } });
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
  models = createModels(connection);
  await ensureIndexes(models);
  repository = createRepository(models);
});

beforeEach(async () => {
  await Promise.all([models.Admin.deleteMany({}), models.AdminSession.deleteMany({})]);
  app = makeApp();
  logEntries.length = 0;
});

after(async () => {
  await connection?.close();
  await mongo?.stop();
});

test('password hashing produces unique salts and verifies correctly in constant time', async () => {
  const hash1 = await hashPassword('secret123');
  const hash2 = await hashPassword('secret123');
  assert.notEqual(hash1, hash2);
  assert.equal(await verifyPassword('secret123', hash1), true);
  assert.equal(await verifyPassword('wrongpassword', hash1), false);
  assert.equal(await verifyPassword('', hash1), false);
});

test('admin model enforces lowercase username and uniqueness', async () => {
  const hash = await hashPassword('securePass123');
  await models.Admin.create({ username: 'Owner', passwordHash: hash });
  const found = await models.Admin.findOne({ username: 'owner' }).lean();
  assert.ok(found);
  assert.equal(found.username, 'owner');
  await assert.rejects(models.Admin.create({ username: 'owner', passwordHash: hash }));
});

test('admin login rejects invalid credentials without revealing user existence', async () => {
  const hash = await hashPassword('correctPass123');
  await models.Admin.create({ username: 'admin', passwordHash: hash });

  const wrongUser = await request(app).post('/api/admin/login').send({ username: 'nonexistent', password: 'password123' });
  assert.equal(wrongUser.status, 401);
  assert.equal(wrongUser.body.error.code, 'INVALID_CREDENTIALS');

  const wrongPass = await request(app).post('/api/admin/login').send({ username: 'admin', password: 'wrongPassword' });
  assert.equal(wrongPass.status, 401);
  assert.equal(wrongPass.body.error.code, 'INVALID_CREDENTIALS');
});

test('successful admin login issues httpOnly cookie and returns csrfToken and user info', async () => {
  const hash = await hashPassword('ownerSecret99');
  await models.Admin.create({ username: 'owner', passwordHash: hash, name: 'مالك المطعم' });

  const response = await request(app).post('/api/admin/login').send({ username: 'owner', password: 'ownerSecret99' });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.username, 'owner');
  assert.equal(response.body.data.user.name, 'مالك المطعم');
  assert.ok(response.body.data.csrfToken);

  const setCookie = response.headers['set-cookie'];
  assert.ok(setCookie);
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(cookieStr.includes('admin_session='));
  assert.ok(cookieStr.toLowerCase().includes('httponly'));
  assert.ok(cookieStr.toLowerCase().includes('samesite=lax'));

  // Session must be in MongoDB
  const cookies = parseCookies(cookieStr);
  const session = await models.AdminSession.findOne({ sessionId: cookies.admin_session });
  assert.ok(session);
  assert.equal(session.csrfToken, response.body.data.csrfToken);
});

test('admin/me verifies active session and rejects unauthenticated requests', async () => {
  const unauth = await request(app).get('/api/admin/me');
  assert.equal(unauth.status, 401);
  assert.equal(unauth.body.error.code, 'UNAUTHORIZED');

  const hash = await hashPassword('mypassword1');
  await models.Admin.create({ username: 'chef', passwordHash: hash });
  const loginRes = await request(app).post('/api/admin/login').send({ username: 'chef', password: 'mypassword1' });
  const cookie = loginRes.headers['set-cookie'][0];

  const authRes = await request(app).get('/api/admin/me').set('Cookie', cookie);
  assert.equal(authRes.status, 200);
  assert.equal(authRes.body.data.authenticated, true);
  assert.equal(authRes.body.data.user.username, 'chef');
  assert.ok(authRes.body.data.csrfToken);
});

test('logout requires matching CSRF token and destroys MongoDB session and cookie', async () => {
  const hash = await hashPassword('password123');
  await models.Admin.create({ username: 'manager', passwordHash: hash });
  const loginRes = await request(app).post('/api/admin/login').send({ username: 'manager', password: 'password123' });
  const cookie = loginRes.headers['set-cookie'][0];
  const csrfToken = loginRes.body.data.csrfToken;

  // Missing CSRF token -> 403
  const badCsrf = await request(app).post('/api/admin/logout').set('Cookie', cookie);
  assert.equal(badCsrf.status, 403);
  assert.equal(badCsrf.body.error.code, 'CSRF_INVALID');

  // Wrong CSRF token -> 403
  const wrongCsrf = await request(app).post('/api/admin/logout').set('Cookie', cookie).set('X-CSRF-Token', 'wrong-token');
  assert.equal(wrongCsrf.status, 403);
  assert.equal(wrongCsrf.body.error.code, 'CSRF_INVALID');

  // Valid CSRF token -> 200
  const logoutRes = await request(app).post('/api/admin/logout').set('Cookie', cookie).set('X-CSRF-Token', csrfToken);
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.data.loggedOut, true);

  // Cookie must be cleared
  const clearedCookie = logoutRes.headers['set-cookie']?.[0] || '';
  assert.ok(clearedCookie.includes('admin_session=;') || clearedCookie.includes('Expires=Thu, 01 Jan 1970'));

  // Session must be deleted from MongoDB
  const cookies = parseCookies(cookie);
  const remainingSession = await models.AdminSession.findOne({ sessionId: cookies.admin_session });
  assert.equal(remainingSession, null);

  // Subsequent me request is now 401
  const afterLogout = await request(app).get('/api/admin/me').set('Cookie', cookie);
  assert.equal(afterLogout.status, 401);
});

test('rate limiting protects admin login against brute force', async () => {
  const limitedApp = makeApp({ limiter: { adminLogin: 3 } });
  for (let i = 0; i < 3; i++) {
    const res = await request(limitedApp).post('/api/admin/login').send({ username: 'test', password: 'bad' });
    assert.equal(res.status, 401);
  }
  const fourth = await request(limitedApp).post('/api/admin/login').send({ username: 'test', password: 'bad' });
  assert.equal(fourth.status, 429);
  assert.equal(fourth.body.error.code, 'RATE_LIMITED');
});

test('production sessions persist across every admin area, retain CSRF and clear securely', async () => {
  const origin = 'https://family-restaurant-menu.onrender.com';
  const legacyOrigin = 'https://family-restaurant-menu-1.onrender.com';
  const productionApp = makeApp({ config: { ...config, nodeEnv: 'production', trustProxy: 1, allowedOrigins: [origin, legacyOrigin] } });
  const legacyMenu = await request(productionApp).get('/api/categories').set('Origin', legacyOrigin);
  assert.equal(legacyMenu.status, 200);
  assert.equal(legacyMenu.headers['access-control-allow-origin'], legacyOrigin);
  await models.Admin.create({ username: 'production-test-owner', passwordHash: await hashPassword('test-only-password') });
  const login = await request(productionApp).post('/api/admin/login').set('Origin', origin).set('X-Forwarded-Proto', 'https')
    .send({ username: 'production-test-owner', password: 'test-only-password' });
  assert.equal(login.status, 200);
  assert.equal(login.headers['access-control-allow-origin'], origin);
  assert.equal(login.headers['access-control-allow-credentials'], 'true');
  const issued = login.headers['set-cookie'][0];
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(issued.includes(attribute));
  assert.equal(/;\s*Domain=/i.test(issued), false);
  const cookie = issued.split(';')[0];
  const sessionId = parseCookies(cookie)[ADMIN_SESSION_COOKIE];
  assert.equal(JSON.stringify(login.body).includes(sessionId), false);
  const csrfToken = login.body.data.csrfToken;
  for (const area of ['me', 'categories', 'products', 'offers', 'settings', 'orders']) {
    const response = await request(productionApp).get(`/api/admin/${area}`).set('Origin', origin).set('Cookie', cookie);
    assert.equal(response.status, 200, `Authenticated ${area}`);
  }
  for (const token of [undefined, 'incorrect-test-token']) {
    let mutation = request(productionApp).patch('/api/admin/settings').set('Origin', origin).set('Cookie', cookie);
    if (token) mutation = mutation.set('X-CSRF-Token', token);
    const response = await mutation.send({ acceptingOrders: false });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'CSRF_INVALID');
  }
  const updated = await request(productionApp).patch('/api/admin/settings').set('Origin', origin).set('Cookie', cookie)
    .set('X-CSRF-Token', csrfToken).send({ acceptingOrders: false });
  assert.equal(updated.status, 200);
  const hostile = await request(productionApp).patch('/api/admin/settings').set('Origin', 'https://untrusted.invalid')
    .set('Cookie', cookie).set('X-CSRF-Token', csrfToken).send({ acceptingOrders: true });
  assert.equal(hostile.status, 403);
  assert.equal(hostile.body.error.code, 'ORIGIN_DENIED');
  const logout = await request(productionApp).post('/api/admin/logout').set('Origin', origin).set('Cookie', cookie).set('X-CSRF-Token', csrfToken);
  assert.equal(logout.status, 200);
  const cleared = logout.headers['set-cookie'][0];
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cleared.includes(attribute));
  assert.equal((await request(productionApp).get('/api/admin/me').set('Cookie', cookie)).status, 401);
});
