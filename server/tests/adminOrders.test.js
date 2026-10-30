import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/auth.js';
import { hashToken } from '../src/services/orderService.js';
import { migrateOrderStatuses } from '../scripts/migrateOrderStatus.js';

let mongo, connection, models, repository, app;
let adminCookie, csrfToken;
let testCategory, testProduct;
const config = { allowedOrigins: ['http://localhost:5173'], trustProxy: 0, nodeEnv: 'test' };
const logEntries = [];
const logger = { info(event, fields) { logEntries.push({ event, fields }); }, error(event, fields) { logEntries.push({ event, fields }); } };

before(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
    instance: { dbName: 'family_menu_orders' },
  });
  connection = await mongoose.createConnection(mongo.getUri(), {
    dbName: 'family_menu_orders',
    autoIndex: false,
    bufferCommands: false,
  }).asPromise();
  models = createModels(connection);
  await ensureIndexes(models);
  repository = createRepository(models);
  app = createApp({ repository, config, logger, limiter: { adminLogin: 100 } });
});

beforeEach(async () => {
  await Promise.all([
    models.Category.deleteMany({}),
    models.Product.deleteMany({}),
    models.Order.deleteMany({}),
    models.Admin.deleteMany({}),
    models.AdminSession.deleteMany({}),
    models.StoreSettings.deleteMany({}),
  ]);

  // Seed default store settings
  await models.StoreSettings.create({
    _id: 'store',
    restaurantName: 'مطعم ومطبخ العائلة',
    isOpen: true,
    acceptingOrders: true,
    pickupEnabled: true,
    deliveryEnabled: true,
  });

  // Seed admin and login
  const passwordHash = await hashPassword('adminPass123');
  await models.Admin.create({ username: 'owner', passwordHash, name: 'مالك المطعم' });

  const loginRes = await request(app).post('/api/admin/login').send({ username: 'owner', password: 'adminPass123' });
  adminCookie = loginRes.headers['set-cookie'][0];
  csrfToken = loginRes.body.data.csrfToken;

  testCategory = await models.Category.create({
    name: 'وجبات عائلية',
    slug: 'family-meals',
    sortOrder: 1,
    isActive: true,
  });

  testProduct = await models.Product.create({
    name: 'وجبة بروست 8 قطع',
    slug: 'broast-8',
    price: 85,
    categoryId: testCategory._id,
    isAvailable: true,
  });
});

after(async () => {
  await connection?.close();
  await mongo?.stop();
});

function createTestOrder(overrides = {}) {
  const token = randomBytes(32).toString('base64url');
  return models.Order.create({
    orderNumber: `FAM-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
    submissionId: randomUUID(),
    requestFingerprint: randomUUID(),
    accessTokenHash: hashToken(token),
    customer: { name: 'محمود خليل', phone: '0599123456' },
    fulfillmentType: 'pickup',
    items: [
      {
        productId: testProduct._id,
        name: testProduct.name,
        quantity: 1,
        unitPrice: 85,
        lineTotal: 85,
      },
    ],
    productsSubtotal: 85,
    status: 'new',
    ...overrides,
  });
}

test('newly submitted orders receive "new" status', async () => {
  const payload = {
    submissionId: randomUUID(),
    confirmationToken: randomBytes(32).toString('base64url'),
    customer: { name: 'أحمد سعيد', phone: '0599223344' },
    fulfillmentType: 'pickup',
    items: [{ productId: String(testProduct._id), quantity: 1, expectedUnitPrice: 85 }],
    expectedProductsSubtotal: 85,
  };

  const response = await request(app).post('/api/orders').send(payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.data.order.status, 'new');

  const saved = await models.Order.findById(response.body.data.order.id).lean();
  assert.equal(saved.status, 'new');
});

test('admin orders endpoints require authentication and CSRF', async () => {
  const order = await createTestOrder();

  // No auth -> 401
  const noAuthList = await request(app).get('/api/admin/orders');
  assert.equal(noAuthList.status, 401);

  const noAuthDetail = await request(app).get(`/api/admin/orders/${order._id}`);
  assert.equal(noAuthDetail.status, 401);

  // Authenticated list -> 200
  const authList = await request(app).get('/api/admin/orders').set('Cookie', adminCookie);
  assert.equal(authList.status, 200);

  // Status patch without CSRF -> 403
  const noCsrfPatch = await request(app).patch(`/api/admin/orders/${order._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'received' });
  assert.equal(noCsrfPatch.status, 403);
  assert.equal(noCsrfPatch.body.error.code, 'CSRF_INVALID');
});

test('admin orders list supports filtering and counts', async () => {
  await createTestOrder({ status: 'new' });
  await createTestOrder({ status: 'received' });
  await createTestOrder({ status: 'prepared' });

  // Get all
  const allRes = await request(app).get('/api/admin/orders').set('Cookie', adminCookie);
  assert.equal(allRes.status, 200);
  assert.equal(allRes.body.data.total, 3);
  assert.equal(allRes.body.data.newCount, 1);
  assert.equal(allRes.body.data.orders.length, 3);

  // Filter new
  const newRes = await request(app).get('/api/admin/orders?status=new').set('Cookie', adminCookie);
  assert.equal(newRes.body.data.total, 1);
  assert.equal(newRes.body.data.orders[0].status, 'new');

  // Filter received
  const recRes = await request(app).get('/api/admin/orders?status=received').set('Cookie', adminCookie);
  assert.equal(recRes.body.data.total, 1);
  assert.equal(recRes.body.data.orders[0].status, 'received');

  // Filter prepared
  const prepRes = await request(app).get('/api/admin/orders?status=prepared').set('Cookie', adminCookie);
  assert.equal(prepRes.body.data.total, 1);
  assert.equal(prepRes.body.data.orders[0].status, 'prepared');
});

test('three-status flow: new -> received -> prepared works with atomic verification', async () => {
  const order = await createTestOrder({ status: 'new' });
  const orderId = String(order._id);

  // 1. Transition new -> received
  const step1 = await request(app).patch(`/api/admin/orders/${orderId}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'received' });

  assert.equal(step1.status, 200);
  assert.equal(step1.body.data.status, 'received');

  // Verify in database
  const saved1 = await models.Order.findById(orderId).lean();
  assert.equal(saved1.status, 'received');

  // 2. Transition received -> prepared
  const step2 = await request(app).patch(`/api/admin/orders/${orderId}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'prepared' });

  assert.equal(step2.status, 200);
  assert.equal(step2.body.data.status, 'prepared');

  // Verify in database
  const saved2 = await models.Order.findById(orderId).lean();
  assert.equal(saved2.status, 'prepared');
});

test('invalid transitions are strictly rejected', async () => {
  // Test: Skipping new -> prepared
  const orderNew = await createTestOrder({ status: 'new' });
  const skipRes = await request(app).patch(`/api/admin/orders/${orderNew._id}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'prepared' });
  assert.equal(skipRes.status, 400);
  assert.equal(skipRes.body.error.code, 'SKIPPED_STATUS');

  // Test: Reversal prepared -> received
  const orderPrep = await createTestOrder({ status: 'prepared' });
  const revRes = await request(app).patch(`/api/admin/orders/${orderPrep._id}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'received' });
  assert.equal(revRes.status, 400);

  // Test: Disallowed status values (e.g. cancelled, completed, confirmed)
  const invalidVal = await request(app).patch(`/api/admin/orders/${orderNew._id}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'cancelled' });
  assert.equal(invalidVal.status, 400);
  assert.equal(invalidVal.body.error.code, 'VALIDATION_ERROR');
});

test('legacy confirmed orders are normalized and migratable', async () => {
  // Create order with legacy status 'confirmed'
  const legacyOrder = await createTestOrder({ status: 'confirmed' });

  // Admin GET normalizes to 'new'
  const detailRes = await request(app).get(`/api/admin/orders/${legacyOrder._id}`)
    .set('Cookie', adminCookie);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.data.status, 'new');

  // Can transition from legacy confirmed to received
  const transRes = await request(app).patch(`/api/admin/orders/${legacyOrder._id}/status`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ status: 'received' });
  assert.equal(transRes.status, 200);
  assert.equal(transRes.body.data.status, 'received');

  // Test migration script
  const secondLegacy = await createTestOrder({ status: 'confirmed' });
  const dryRunSummary = await migrateOrderStatuses(models, { dryRun: true });
  assert.equal(dryRunSummary.toNew, 1);

  // Still confirmed in database
  assert.equal((await models.Order.findById(secondLegacy._id).lean()).status, 'confirmed');

  // Live migration
  const liveSummary = await migrateOrderStatuses(models, { dryRun: false });
  assert.equal(liveSummary.toNew, 1);
  assert.equal((await models.Order.findById(secondLegacy._id).lean()).status, 'new');
});
