import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createPushService } from '../src/services/pushService.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/auth.js';

let mongo, connection, models, repository, app, pushService;
let adminCookie, csrfToken, adminUser;
let testCategory, testProduct;
const mockSentNotifications = [];
let mockWebPushFailNext = false;
let mockWebPushStatusCode = 201;

const mockWebPushClient = {
  setVapidDetails() {},
  async sendNotification(subscription, payload, options) {
    if (mockWebPushFailNext) {
      const err = new Error('Push delivery failed');
      err.statusCode = mockWebPushStatusCode;
      throw err;
    }
    mockSentNotifications.push({ subscription, payload: JSON.parse(payload), options });
    return { statusCode: 201 };
  },
};

const fakeVapid = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckj0Gy2jx_WQBkp5GER2OiZXGsDUfM',
  privateKey: 'fake_private_key_for_testing_purposes_only',
  subject: 'mailto:test@family-restaurant.local',
};

const config = {
  allowedOrigins: ['http://localhost:5173'],
  trustProxy: 0,
  nodeEnv: 'test',
  vapid: fakeVapid,
};

before(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
    instance: { dbName: 'family_menu_push' },
  });
  connection = await mongoose.createConnection(mongo.getUri(), {
    dbName: 'family_menu_push',
    autoIndex: false,
    bufferCommands: false,
  }).asPromise();
  models = createModels(connection);
  await ensureIndexes(models);
  repository = createRepository(models);
  pushService = createPushService({ repository, vapid: fakeVapid, webpushClient: mockWebPushClient });
  app = createApp({ repository, config, pushService });
});

beforeEach(async () => {
  mockSentNotifications.length = 0;
  mockWebPushFailNext = false;
  mockWebPushStatusCode = 201;

  await Promise.all([
    models.Category.deleteMany({}),
    models.Product.deleteMany({}),
    models.Order.deleteMany({}),
    models.Admin.deleteMany({}),
    models.AdminSession.deleteMany({}),
    models.StoreSettings.deleteMany({}),
    models.AdminPushSubscription.deleteMany({}),
    models.PushNotificationJob.deleteMany({}),
  ]);

  await models.StoreSettings.create({
    _id: 'store',
    restaurantName: 'مطعم ومطبخ العائلة',
    isOpen: true,
    acceptingOrders: true,
    pickupEnabled: true,
    deliveryEnabled: true,
  });

  const passwordHash = await hashPassword('adminPass123');
  adminUser = await models.Admin.create({ username: 'owner', passwordHash, name: 'مالك المطعم' });

  const loginRes = await request(app)
    .post('/api/admin/login')
    .send({ username: 'owner', password: 'adminPass123' })
    .expect(200);

  adminCookie = loginRes.headers['set-cookie'][0];
  csrfToken = loginRes.body.data.csrfToken;

  testCategory = await models.Category.create({
    name: 'وجبات البروست',
    slug: 'broast',
    sortOrder: 1,
    isActive: true,
  });

  testProduct = await models.Product.create({
    name: 'بروست 4 قطع',
    slug: 'broast-4',
    price: 35,
    categoryId: testCategory._id,
    isAvailable: true,
  });
});

after(async () => {
  if (connection) await connection.close();
  if (mongo) await mongo.stop();
});

test('push endpoints require authentication and CSRF for writes', async () => {
  await request(app)
    .get('/api/admin/push/public-key')
    .expect(401);

  await request(app)
    .post('/api/admin/push/subscribe')
    .set('Cookie', adminCookie)
    .send({ endpoint: 'https://push.example.com/sub/1', keys: { p256dh: 'k1', auth: 'a1' } })
    .expect(403);

  await request(app)
    .post('/api/admin/push/unsubscribe')
    .set('Cookie', adminCookie)
    .send({ endpoint: 'https://push.example.com/sub/1' })
    .expect(403);
});

test('public-key returns configured VAPID public key', async () => {
  const res = await request(app)
    .get('/api/admin/push/public-key')
    .set('Cookie', adminCookie)
    .expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.publicKey, fakeVapid.publicKey);
});

test('subscribe validates payload and stores device subscription in MongoDB', async () => {
  // Invalid endpoint URL rejected
  await request(app)
    .post('/api/admin/push/subscribe')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ endpoint: 'not-a-url', keys: { p256dh: 'k1', auth: 'a1' } })
    .expect(400);

  // Valid subscription succeeds
  const res = await request(app)
    .post('/api/admin/push/subscribe')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-iphone',
      keys: { p256dh: 'key_p256dh_123', auth: 'key_auth_456' },
      device: { platform: 'iPhone', label: 'iPhone 15' },
    })
    .expect(201);

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.subscribed, true);

  const sub = await models.AdminPushSubscription.findOne({ endpoint: 'https://fcm.googleapis.com/fcm/send/device-iphone' });
  assert.ok(sub);
  assert.equal(sub.keys.p256dh, 'key_p256dh_123');
  assert.equal(sub.device.platform, 'iPhone');
});

test('multiple devices can subscribe independently and unsubscribe removes only current device', async () => {
  // Subscribe iPhone
  await request(app)
    .post('/api/admin/push/subscribe')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      endpoint: 'https://fcm.googleapis.com/fcm/send/iphone',
      keys: { p256dh: 'k-iphone', auth: 'a-iphone' },
      device: { platform: 'iPhone', label: 'iPhone' },
    })
    .expect(201);

  // Subscribe iPad
  await request(app)
    .post('/api/admin/push/subscribe')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      endpoint: 'https://web.push.apple.com/sub/ipad',
      keys: { p256dh: 'k-ipad', auth: 'a-ipad' },
      device: { platform: 'iPad', label: 'iPad 11' },
    })
    .expect(201);

  const statusRes = await request(app)
    .get('/api/admin/push/status?endpoint=https://fcm.googleapis.com/fcm/send/iphone')
    .set('Cookie', adminCookie)
    .expect(200);

  assert.equal(statusRes.body.data.deviceCount, 2);
  assert.equal(statusRes.body.data.isSubscribed, true);

  // Unsubscribe iPhone
  await request(app)
    .post('/api/admin/push/unsubscribe')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/iphone' })
    .expect(200);

  const remaining = await models.AdminPushSubscription.find();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].endpoint, 'https://web.push.apple.com/sub/ipad');
});

test('new customer order enqueues push notification job and does not duplicate on replay', async () => {
  const submissionId = randomUUID();
  const confirmationToken = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE';
  const orderPayload = {
    submissionId,
    confirmationToken,
    customer: { name: 'سامي يوسف', phone: '0599112233' },
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    notes: 'بدون شطة',
    items: [{ productId: String(testProduct._id), quantity: 2, expectedUnitPrice: 35 }],
    expectedProductsSubtotal: 70,
  };

  const submitRes = await request(app)
    .post('/api/orders')
    .send(orderPayload)
    .expect(201);

  assert.equal(submitRes.body.success, true);
  const orderId = submitRes.body.data.order.id;

  const job = await models.PushNotificationJob.findOne({ orderId });
  assert.ok(job);
  assert.equal(job.orderNumber, submitRes.body.data.order.orderNumber);

  // Replay order submission (idempotent)
  await request(app)
    .post('/api/orders')
    .send(orderPayload)
    .expect(200);

  const jobCount = await models.PushNotificationJob.countDocuments({ orderId });
  assert.equal(jobCount, 1); // Exactly one job exists
});

test('worker delivers push notification to all subscribed devices and cleans up dead subscriptions (410 Gone)', async () => {
  // Subscribe active device
  await models.AdminPushSubscription.create({
    adminId: adminUser._id,
    endpoint: 'https://web.push.apple.com/sub/active-device',
    keys: { p256dh: 'k1', auth: 'a1' },
    device: { platform: 'iPad' },
  });

  // Subscribe dead device that will return 410
  await models.AdminPushSubscription.create({
    adminId: adminUser._id,
    endpoint: 'https://web.push.apple.com/sub/expired-device',
    keys: { p256dh: 'k2', auth: 'a2' },
    device: { platform: 'Old-Phone' },
  });

  const dummyOrder = await models.Order.create({
    orderNumber: 'FAM-20261030-TEST1234',
    submissionId: randomUUID(),
    requestFingerprint: 'dummy-fp',
    accessTokenHash: 'dummy-hash',
    customer: { name: 'عميل تجريبي', phone: '0599000000' },
    fulfillmentType: 'pickup',
    items: [{ productId: testProduct._id, name: 'بروست', quantity: 1, unitPrice: 35, lineTotal: 35 }],
    productsSubtotal: 35,
    status: 'new',
  });

  // Custom mock for this test: fail expired device with 410, succeed active device
  let sendCount = 0;
  mockWebPushClient.sendNotification = async (sub, payload) => {
    sendCount++;
    if (sub.endpoint.includes('expired-device')) {
      const err = new Error('Device subscription has expired');
      err.statusCode = 410;
      throw err;
    }
    mockSentNotifications.push({ sub, payload: JSON.parse(payload) });
    return { statusCode: 201 };
  };

  // Enqueue job and wait for worker to process
  await pushService.enqueueNewOrderNotification({ orderId: dummyOrder._id, orderNumber: dummyOrder.orderNumber });
  await pushService.processJobs();

  assert.equal(sendCount, 2);
  assert.equal(mockSentNotifications.length, 1);
  assert.match(mockSentNotifications[0].payload.title, /طلب جديد/);
  assert.match(mockSentNotifications[0].payload.body, /FAM-20261030-TEST1234/);
  assert.equal(mockSentNotifications[0].payload.data.orderId, String(dummyOrder._id));

  // Verify expired device was cleaned up automatically
  const remaining = await models.AdminPushSubscription.find();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].endpoint, 'https://web.push.apple.com/sub/active-device');

  // Verify job completed
  const completedJob = await models.PushNotificationJob.findOne({ orderId: dummyOrder._id });
  assert.equal(completedJob.status, 'completed');
});
