import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createOrderService } from '../src/services/orderService.js';
import { validateOrder } from '../src/validators/orders.js';
import { createApp } from '../src/app.js';
import { seedData } from '../scripts/seedData.js';
import { buildAllowedOrigins } from '../src/config/origins.js';

let mongo, connection, models, repository, app, product4, wings, category;
const config = { allowedOrigins: ['http://localhost:5173'], trustProxy: 0 };
const logEntries = [];
const logger = { info(event, fields) { logEntries.push({ event, fields }); }, error(event, fields) { logEntries.push({ event, fields }); } };
const makeApp = (options = {}) => createApp({ repository, config, logger, limiter: { orders: 1000, confirmations: 1000 }, ...options });
const token = () => randomBytes(32).toString('base64url');
function body(overrides = {}) {
  return { submissionId: randomUUID(), confirmationToken: token(), customer: { name: 'أحمد أبو عيشة', phone: '+970599123456' }, fulfillmentType: 'pickup', notes: '', items: [{ productId: String(product4._id), quantity: 2, expectedUnitPrice: 35 }, { productId: String(wings._id), quantity: 1, expectedUnitPrice: 28 }], expectedProductsSubtotal: 98, ...overrides };
}
async function order(payload = body()) { const response = await request(app).post('/api/orders').send(payload); assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data.order; }

before(async () => {
  // This process never reads MONGODB_URI. It owns a fresh local test server only.
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu' } });
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
  assert.equal(connection.host, '127.0.0.1');
  assert.equal(connection.name, 'family_menu');
  models = createModels(connection);
  await ensureIndexes(models);
  repository = createRepository(models);
});
beforeEach(async () => {
  // These collections belong exclusively to the isolated server created above.
  await Promise.all(Object.values(models).map((model) => model.deleteMany({})));
  await seedData(models);
  [product4, wings, category] = await Promise.all([models.Product.findOne({ slug: 'broast-4' }).lean(), models.Product.findOne({ slug: 'hot-wings' }).lean(), models.Category.findOne({ slug: 'broast' }).lean()]);
  app = makeApp();
  logEntries.length = 0;
});
after(async () => { await connection?.close(); await mongo?.stop(); });

test('health and public categories expose only active sorted menu data', async () => {
  assert.equal((await request(app).get('/api/health')).body.data.status, 'ok');
  await models.Category.updateOne({ slug: 'drinks' }, { isActive: false });
  const response = await request(app).get('/api/categories');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 5);
  assert.equal(response.body.data[0].id, 'broast');
  assert.equal(response.body.data.some((entry) => entry.id === 'drinks'), false);
});

test('public products support category filtering and hide unavailable or inactive-category items', async () => {
  const response = await request(app).get('/api/products?category=broast');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 3);
  assert.ok(response.body.data.every((product) => product.categoryId === 'broast'));
  assert.match(response.body.data[0].databaseId, /^[a-f\d]{24}$/);
  assert.equal((await request(app).get(`/api/products?category=${category._id}`)).body.data.length, 3);
  await models.Product.updateOne({ _id: product4._id }, { isAvailable: false });
  assert.equal((await request(app).get(`/api/products/${product4._id}`)).status, 404);
  await models.Category.updateOne({ _id: category._id }, { isActive: false });
  assert.equal((await request(app).get('/api/products?category=broast')).body.data.length, 0);
});

test('individual product retrieval validates IDs and excludes query injection', async () => {
  assert.equal((await request(app).get(`/api/products/${product4._id}`)).body.data.name, product4.name);
  assert.equal((await request(app).get('/api/products/not-an-id')).status, 400);
  assert.equal((await request(app).get('/api/products?category=%7B%22%24ne%22%3Anull%7D')).status, 400);
});

test('only current active associated offers appear; multiple offers are sorted consistently', async () => {
  const now = Date.now();
  const base = { title: 'عرض', originalPrice: 35, offerPrice: 30, productId: product4._id, startDate: new Date(now - 10000), endDate: new Date(now + 60000), isActive: true };
  await models.Offer.create([{ ...base, slug: 'current' }, { ...base, slug: 'cheaper', offerPrice: 25 }, { ...base, slug: 'expired', endDate: new Date(now - 1) }, { ...base, slug: 'future', startDate: new Date(now + 20000) }, { ...base, slug: 'disabled', isActive: false }, { ...base, slug: 'standalone', productId: null }]);
  const response = await request(app).get('/api/offers');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((entry) => entry.offerPrice), [25, 30]);
  assert.equal(response.body.data[0].productId, 'broast-4');
});

test('store endpoint exposes operational settings and defaults support normal ordering', async () => {
  const response = await request(app).get('/api/store');
  assert.equal(response.body.data.restaurantName, 'مطعم ومطبخ العائلة');
  assert.equal('_id' in response.body.data, false);
  assert.equal(JSON.stringify(response.body).includes('MONGODB'), false);
  await models.StoreSettings.deleteOne({ _id: 'store' });
  assert.equal((await request(app).get('/api/store')).body.data.acceptingOrders, true);
  assert.equal((await request(app).post('/api/orders').send(body())).status, 201);
});

test('pickup is persisted with server snapshots, unique number and automatically confirmed status', async () => {
  const payload = body({ deliveryAddress: 'لا يحفظ للاستلام' });
  const result = await order(payload);
  assert.equal(result.status, 'new');
  assert.equal(result.productsSubtotal, 98);
  assert.equal(result.items[0].lineTotal, 70);
  assert.equal(result.items[0].unitPrice, 35);
  assert.equal(result.customer.phone, '0599123456');
  assert.equal(result.deliveryAddress, null);
  assert.match(result.orderNumber, /^FAM-/);
  const saved = await models.Order.findById(result.id).select('+accessTokenHash +submissionId').lean();
  assert.equal(saved.status, 'new');
  assert.equal(saved.productsSubtotal, 98);
  assert.notEqual(saved.accessTokenHash, payload.confirmationToken);
  assert.equal(saved.submissionId, payload.submissionId);
  assert.equal('accessTokenHash' in result, false);
  assert.equal('requestFingerprint' in result, false);
  await models.Product.updateOne({ _id: product4._id }, { name: 'اسم جديد', price: 50 });
  assert.equal((await models.Order.findById(result.id)).items[0].name, product4.name);
});

test('delivery saves address and notes, products-only total, and no delivery or payment fields', async () => {
  const result = await order(body({ fulfillmentType: 'delivery', deliveryAddress: 'نابلس، شارع الجامعة، بجانب المكتبة', notes: 'بدون مخلل' }));
  assert.match(result.deliveryAddress, /نابلس/);
  assert.equal(result.notes, 'بدون مخلل');
  assert.equal(result.productsSubtotal, 98);
  assert.equal('deliveryFee' in result, false);
  assert.equal('payment' in result, false);
});

test('missing names, malformed phone numbers, missing delivery address and empty carts are rejected', async () => {
  for (const patch of [{ customer: { name: '', phone: '0599123456' } }, { customer: { name: 'أحمد', phone: '123' } }, { fulfillmentType: 'delivery', deliveryAddress: '' }, { items: [] }]) {
    const response = await request(app).post('/api/orders').send(body(patch));
    assert.equal(response.status, 422, JSON.stringify(response.body));
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(await models.Order.countDocuments(), 0);
});

test('unavailable products and inactive categories cannot be ordered', async () => {
  await models.Product.updateOne({ _id: product4._id }, { isAvailable: false });
  assert.equal((await request(app).post('/api/orders').send(body())).body.error.code, 'UNAVAILABLE_PRODUCT');
  await models.Product.updateOne({ _id: product4._id }, { isAvailable: true });
  await models.Category.updateOne({ _id: category._id }, { isActive: false });
  assert.equal((await request(app).post('/api/orders').send(body())).body.error.code, 'UNAVAILABLE_PRODUCT');
  assert.equal(await models.Order.countDocuments(), 0);
});

test('active offers use database prices; expired and mismatched explicit offers are rejected', async () => {
  const active = await models.Offer.create({ slug: 'active', title: 'عرض بروست', productId: product4._id, originalPrice: 35, offerPrice: 30, isActive: true, startDate: new Date(Date.now() - 10000), endDate: new Date(Date.now() + 60000) });
  const payload = body({ items: [{ productId: String(product4._id), offerId: String(active._id), quantity: 2, expectedUnitPrice: 30 }], expectedProductsSubtotal: 60 });
  const result = await order(payload);
  assert.equal(result.productsSubtotal, 60);
  assert.equal(result.items[0].offerId, String(active._id));
  await models.Offer.updateOne({ _id: active._id }, { endDate: new Date(Date.now() - 1) });
  assert.equal((await request(app).post('/api/orders').send({ ...payload, submissionId: randomUUID() })).body.error.code, 'OFFER_UNAVAILABLE');
});

test('tampered or outdated quote values never become confirmed prices', async () => {
  const payload = body({ expectedProductsSubtotal: 1 });
  const response = await request(app).post('/api/orders').send(payload);
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'PRICE_CHANGED');
  assert.equal(response.body.error.details.productsSubtotal, 98);
  assert.equal(await models.Order.countDocuments(), 0);
  const unitChanged = body(); unitChanged.items[0].expectedUnitPrice = .01;
  assert.equal((await request(app).post('/api/orders').send(unitChanged)).body.error.code, 'PRICE_CHANGED');
});

test('invalid object IDs, duplicate lines and mass-assigned prices or status are rejected', async () => {
  for (const payload of [body({ status: 'completed' }), body({ productsSubtotal: .01 }), body({ items: [{ productId: 'invalid', quantity: 1, expectedUnitPrice: 1 }] }), body({ items: [{ productId: String(product4._id), quantity: 1, expectedUnitPrice: 35, price: .01 }] }), body({ items: [body().items[0], body().items[0]] })]) {
    assert.equal((await request(app).post('/api/orders').send(payload)).status, 422);
  }
  assert.equal(await models.Order.countDocuments(), 0);
});

test('concurrent duplicate submissions are persisted once by the database unique index', async () => {
  const payload = body();
  const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).post('/api/orders').send(payload)));
  assert.ok(responses.every((response) => [200, 201].includes(response.status)), JSON.stringify(responses.map((entry) => entry.body)));
  assert.equal(new Set(responses.map((response) => response.body.data.order.id)).size, 1);
  assert.equal(await models.Order.countDocuments(), 1);
  const indexes = await models.Order.collection.indexes();
  assert.ok(indexes.some((index) => index.key.submissionId && index.unique));
});

test('idempotent retries survive changed store state, while different payload reuse is rejected', async () => {
  const payload = body();
  const first = await order(payload);
  await models.StoreSettings.updateOne({ _id: 'store' }, { isOpen: false });
  const retry = await request(app).post('/api/orders').send(payload);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.order.id, first.id);
  const different = await request(app).post('/api/orders').send({ ...payload, notes: 'ملاحظات مختلفة' });
  assert.equal(different.status, 409);
  assert.equal(different.body.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(await models.Order.countDocuments(), 1);
});

test('closed, paused and disabled fulfillment settings are enforced on the server', async () => {
  for (const [patch, code, extra] of [[{ isOpen: false }, 'STORE_CLOSED', {}], [{ acceptingOrders: false }, 'ORDERS_PAUSED', {}], [{ deliveryEnabled: false }, 'FULFILLMENT_DISABLED', { fulfillmentType: 'delivery', deliveryAddress: 'نابلس، شارع الجامعة' }], [{ pickupEnabled: false }, 'FULFILLMENT_DISABLED', {}]]) {
    await models.StoreSettings.updateOne({ _id: 'store' }, { $set: { isOpen: true, acceptingOrders: true, deliveryEnabled: true, pickupEnabled: true, ...patch } });
    const response = await request(app).post('/api/orders').send(body(extra));
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, code);
    assert.equal((await request(app).get('/api/products')).status, 200);
  }
  assert.equal(await models.Order.countDocuments(), 0);
});

test('confirmation requires the exact order-specific token and exposes no internal secrets', async () => {
  const payload = body(); const result = await order(payload);
  assert.equal((await request(app).get(`/api/orders/${result.id}`)).status, 404);
  assert.equal((await request(app).get(`/api/orders/${result.id}`).set('Authorization', `Bearer ${token()}`)).status, 404);
  assert.equal((await request(app).get(`/api/orders/${result.orderNumber}`).set('Authorization', `Bearer ${payload.confirmationToken}`)).status, 404);
  const response = await request(app).get(`/api/orders/${result.id}`).set('Authorization', `Bearer ${payload.confirmationToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.data.customer.name, payload.customer.name);
  assert.equal(JSON.stringify(response.body).includes(payload.confirmationToken), false);
  assert.equal(JSON.stringify(logEntries).includes(payload.customer.phone), false);
});

test('unique order-number collisions are safely retried without duplicating a request', async () => {
  const first = await order(); let calls = 0;
  const service = createOrderService(repository, { number: () => calls++ === 0 ? first.orderNumber : `FAM-TEST-${randomUUID()}` });
  const result = await service.submit(validateOrder(body()));
  assert.notEqual(result.order.orderNumber, first.orderNumber);
  assert.equal(await models.Order.countDocuments(), 2);
});

test('seeding twice is repeatable and preserves owner edits and all customer orders', async () => {
  await order();
  const counts = await Promise.all([models.Category.countDocuments(), models.Product.countDocuments(), models.Offer.countDocuments()]);
  await models.Product.updateOne({ _id: product4._id }, { price: 44, name: 'وجبة معدلة من المالك' });
  await models.StoreSettings.updateOne({ _id: 'store' }, { announcement: 'إعلان المالك', isOpen: false, acceptingOrders: false, pickupEnabled: false, deliveryEnabled: false });
  const ownerEditedAt = (await models.Product.findById(product4._id)).updatedAt;
  await seedData(models); await seedData(models);
  assert.deepEqual(await Promise.all([models.Category.countDocuments(), models.Product.countDocuments(), models.Offer.countDocuments()]), counts);
  assert.equal((await models.Product.findById(product4._id)).price, 44);
  assert.equal((await models.Product.findById(product4._id)).updatedAt.getTime(), ownerEditedAt.getTime());
  assert.equal((await models.StoreSettings.findById('store')).announcement, 'إعلان المالك');
  const preserved = await models.StoreSettings.findById('store');
  for (const key of ['isOpen', 'acceptingOrders', 'pickupEnabled', 'deliveryEnabled']) assert.equal(preserved[key], false);
  assert.equal(await models.Order.countDocuments(), 1);
});

test('security headers, CORS, body limits and order rate limits are enabled', async () => {
  const health = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(health.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-powered-by'], undefined);
  assert.equal((await request(app).get('/api/store').set('Origin', 'https://untrusted.example')).status, 403);
  assert.equal((await request(app).post('/api/orders').send({ notes: 'a'.repeat(30000) })).status, 413);
  const limitedApp = makeApp({ limiter: { orders: 1, confirmations: 10 } });
  const payload = body();
  assert.equal((await request(limitedApp).post('/api/orders').send(payload)).status, 201);
  assert.equal((await request(limitedApp).post('/api/orders').send(payload)).status, 429);
});

test('public management writes do not exist and unexpected errors reveal no stack or credentials', async () => {
  for (const path of ['/api/products', '/api/categories', '/api/store', '/api/offers', '/api/orders/507f1f77bcf86cd799439011']) assert.equal((await request(app).put(path).send({ status: 'completed' })).status, 404);
  const failing = makeApp({ repository: { ...repository, createOrder: async () => { throw new Error('mongodb+srv://secret:password@private'); } } });
  const response = await request(failing).post('/api/orders').send(body());
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response.body).includes('secret'), false);
  assert.equal(JSON.stringify(response.body).includes('stack'), false);
  assert.equal(JSON.stringify(logEntries).includes('secret'), false);
});

test('models reject negative prices, malformed category references and reversed offer date ranges', async () => {
  await assert.rejects(new models.Product({ name: 'خطأ', slug: 'invalid-product', categoryId: 'bad', price: -1 }).validate());
  await assert.rejects(new models.Offer({ title: 'خطأ', slug: 'invalid-offer', originalPrice: 5, offerPrice: 10, startDate: new Date(), endDate: new Date(0) }).validate());
});

test('fresh store settings allow pickup and delivery without additional approval fields', async () => {
  const settings = new models.StoreSettings().toObject();
  for (const key of ['isOpen', 'acceptingOrders', 'pickupEnabled', 'deliveryEnabled']) assert.equal(settings[key], true);
  const publicSettings = (await request(app).get('/api/store')).body.data;
  assert.deepEqual(Object.keys(publicSettings).sort(), ['restaurantName', 'isOpen', 'acceptingOrders', 'pickupEnabled', 'deliveryEnabled', 'announcement', 'phone'].sort());
  const pickup = await order();
  const delivery = await order(body({ fulfillmentType: 'delivery', deliveryAddress: 'نابلس، شارع الجامعة' }));
  assert.equal(pickup.status, 'new');
  assert.equal(delivery.status, 'new');
});

test('allowed development origins support preflight and real validated POST orders', async () => {
  const allowedOrigins = buildAllowedOrigins({ clientOrigin: 'http://localhost:5173', nodeEnv: 'development', interfaces: { wifi: [{ address: '192.168.42.20', internal: false }] } });
  const developmentApp = makeApp({ config: { ...config, nodeEnv: 'development', allowedOrigins } });
  for (const origin of ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://192.168.42.20:5174']) {
    const preflight = await request(developmentApp).options('/api/orders').set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], origin);
    const submitted = await request(developmentApp).post('/api/orders').set('Origin', origin).send(body());
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal(submitted.body.data.order.status, 'new');
    assert.equal(submitted.body.data.order.productsSubtotal, 98);
  }
  const count = await models.Order.countDocuments();
  for (const origin of ['https://untrusted.example', 'http://192.168.42.99:5174', 'http://localhost:9999', 'null']) assert.equal((await request(developmentApp).post('/api/orders').set('Origin', origin).send(body())).status, 403);
  assert.equal(await models.Order.countDocuments(), count);
  assert.equal((await request(developmentApp).post('/api/orders').set('Origin', 'http://localhost:5174').send({})).status, 422);
  await models.StoreSettings.updateOne({ _id: 'store' }, { isOpen: false });
  assert.equal((await request(developmentApp).post('/api/orders').set('Origin', 'http://192.168.42.20:5174').send(body())).body.error.code, 'STORE_CLOSED');
});

test('production rejects local development origins and accepts only its configured HTTPS site', async () => {
  const allowedOrigins = buildAllowedOrigins({ clientOrigin: 'https://menu.example.com', nodeEnv: 'production', devClientOrigins: 'http://menu.local:5174' });
  const productionApp = makeApp({ config: { ...config, nodeEnv: 'production', allowedOrigins } });
  for (const origin of ['http://localhost:5174', 'http://192.168.42.20:5174', 'https://untrusted.example']) assert.equal((await request(productionApp).post('/api/orders').set('Origin', origin).send(body())).status, 403);
  assert.equal((await request(productionApp).post('/api/orders').set('Origin', 'https://menu.example.com').send(body())).status, 201);
});
