import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/auth.js';

let mongo, connection, models, repository, app, testUploadsDir;
let adminCookie, csrfToken;
let testCategory, testProduct;
const config = { allowedOrigins: ['http://localhost:5173'], trustProxy: 0, nodeEnv: 'test' };
const logEntries = [];
const logger = { info(event, fields) { logEntries.push({ event, fields }); }, error(event, fields) { logEntries.push({ event, fields }); } };

before(async () => {
  testUploadsDir = path.resolve('.cache/test-uploads-offers');
  fs.mkdirSync(testUploadsDir, { recursive: true });

  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu_offers' } });
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: 'family_menu_offers', autoIndex: false, bufferCommands: false }).asPromise();
  models = createModels(connection);
  await ensureIndexes(models);
  repository = createRepository(models);
  app = createApp({ repository, config, logger, limiter: { adminLogin: 100 }, uploadsDir: testUploadsDir });
});

beforeEach(async () => {
  await Promise.all([
    models.Category.deleteMany({}),
    models.Product.deleteMany({}),
    models.Offer.deleteMany({}),
    models.StoreSettings.deleteMany({}),
    models.Admin.deleteMany({}),
    models.AdminSession.deleteMany({}),
  ]);

  // Seed default store settings
  await models.StoreSettings.create({
    _id: 'store',
    restaurantName: 'مطعم ومطبخ العائلة',
    isOpen: true,
    acceptingOrders: true,
    pickupEnabled: true,
    deliveryEnabled: true,
    announcement: '',
    phone: '0599123456',
  });

  // Seed admin and login
  const passwordHash = await hashPassword('adminPass123');
  await models.Admin.create({ username: 'owner', passwordHash, name: 'مالك المطعم' });

  const loginRes = await request(app).post('/api/admin/login').send({ username: 'owner', password: 'adminPass123' });
  adminCookie = loginRes.headers['set-cookie'][0];
  csrfToken = loginRes.body.data.csrfToken;

  // Seed a category and product to link offers to
  testCategory = await models.Category.create({
    name: 'وجبات رئيسية',
    slug: 'main-dishes',
    sortOrder: 1,
    isActive: true,
  });

  testProduct = await models.Product.create({
    name: 'وجبة دجاج مشوي',
    slug: 'grilled-chicken-meal',
    price: 45,
    categoryId: testCategory._id,
    image: '/uploads/chicken.jpg',
    isAvailable: true,
  });
});

after(async () => {
  await connection?.close();
  await mongo?.stop();
  try {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  } catch {}
});

test('unauthenticated or missing CSRF requests are rejected from admin offers and settings', async () => {
  const noAuthOffers = await request(app).get('/api/admin/offers');
  assert.equal(noAuthOffers.status, 401);

  const noCsrfOffers = await request(app).post('/api/admin/offers')
    .set('Cookie', adminCookie)
    .send({
      title: 'عرض تجريبي',
      productId: String(testProduct._id),
      originalPrice: 45,
      offerPrice: 35,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
  assert.equal(noCsrfOffers.status, 403);
  assert.equal(noCsrfOffers.body.error.code, 'CSRF_INVALID');

  const noAuthSettings = await request(app).get('/api/admin/settings');
  assert.equal(noAuthSettings.status, 401);

  const noCsrfSettings = await request(app).patch('/api/admin/settings')
    .set('Cookie', adminCookie)
    .send({ isOpen: false });
  assert.equal(noCsrfSettings.status, 403);
});

test('offer creation validates fields, auto-generates slug, and requires offerPrice <= originalPrice', async () => {
  const now = new Date();
  const tomorrow = new Date(Date.now() + 86400000);

  // Price validation: offerPrice > originalPrice rejected
  const invalidPrice = await request(app).post('/api/admin/offers')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'عرض غير منطقي',
      productId: String(testProduct._id),
      originalPrice: 40,
      offerPrice: 50,
      startDate: now.toISOString(),
      endDate: tomorrow.toISOString(),
    });
  assert.equal(invalidPrice.status, 400);

  // Date validation: endDate < startDate rejected
  const invalidDates = await request(app).post('/api/admin/offers')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'عرض بتاريخ خاطئ',
      productId: String(testProduct._id),
      originalPrice: 45,
      offerPrice: 35,
      startDate: tomorrow.toISOString(),
      endDate: now.toISOString(),
    });
  assert.equal(invalidDates.status, 400);

  // Valid offer creation
  const validRes = await request(app).post('/api/admin/offers')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'عرض الغداء العائلي',
      description: 'دجاج مشوي مع مقبلات مجانية',
      productId: String(testProduct._id),
      originalPrice: 45,
      offerPrice: 35,
      startDate: now.toISOString(),
      endDate: tomorrow.toISOString(),
      isActive: true,
    });
  assert.equal(validRes.status, 201);
  assert.ok(validRes.body.data.id);
  assert.ok(validRes.body.data.slug);
  assert.equal(validRes.body.data.offerPrice, 35);
  assert.equal(validRes.body.data.originalPrice, 45);
  // Keep inheritance dynamic instead of copying the product's current URL.
  assert.equal(validRes.body.data.image, '');

  // Verify it appears in admin list
  const listRes = await request(app).get('/api/admin/offers')
    .set('Cookie', adminCookie);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0].title, 'عرض الغداء العائلي');
  assert.equal(listRes.body.data[0].productId.name, 'وجبة دجاج مشوي');
});

test('offer updating, status toggling, and deletion work correctly', async () => {
  const now = new Date();
  const tomorrow = new Date(Date.now() + 86400000);

  const createRes = await request(app).post('/api/admin/offers')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'عرض الأسبوع',
      productId: String(testProduct._id),
      originalPrice: 45,
      offerPrice: 30,
      startDate: now.toISOString(),
      endDate: tomorrow.toISOString(),
      isActive: true,
    });
  const offerId = createRes.body.data.id;

  // Toggle active to false
  const updateRes = await request(app).patch(`/api/admin/offers/${offerId}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ isActive: false, offerPrice: 28 });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.isActive, false);
  assert.equal(updateRes.body.data.offerPrice, 28);

  // Fetch single offer
  const singleRes = await request(app).get(`/api/admin/offers/${offerId}`)
    .set('Cookie', adminCookie);
  assert.equal(singleRes.status, 200);
  assert.equal(singleRes.body.data.id, offerId);
  assert.equal(singleRes.body.data.isActive, false);

  // Delete offer
  const deleteRes = await request(app).delete(`/api/admin/offers/${offerId}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.data.deleted, true);

  // Verify deleted
  const getDeleted = await request(app).get(`/api/admin/offers/${offerId}`)
    .set('Cookie', adminCookie);
  assert.equal(getDeleted.status, 404);
});

test('admin settings get and patch endpoints control store operational state', async () => {
  // Get initial settings
  const getRes = await request(app).get('/api/admin/settings')
    .set('Cookie', adminCookie);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data.restaurantName, 'مطعم ومطبخ العائلة');
  assert.equal(getRes.body.data.isOpen, true);
  assert.equal(getRes.body.data.acceptingOrders, true);
  assert.equal(getRes.body.data.pickupEnabled, true);
  assert.equal(getRes.body.data.deliveryEnabled, true);

  // Patch settings: close store and add announcement
  const patchRes = await request(app).patch('/api/admin/settings')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      isOpen: false,
      acceptingOrders: false,
      announcement: 'المطعم مغلق لأعمال الصيانة',
      phone: '0599000111',
    });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.data.isOpen, false);
  assert.equal(patchRes.body.data.acceptingOrders, false);
  assert.equal(patchRes.body.data.announcement, 'المطعم مغلق لأعمال الصيانة');
  assert.equal(patchRes.body.data.phone, '0599000111');

  // Verify public /api/store also reflects changes
  const publicStoreRes = await request(app).get('/api/store');
  assert.equal(publicStoreRes.status, 200);
  assert.equal(publicStoreRes.body.data.isOpen, false);
  assert.equal(publicStoreRes.body.data.announcement, 'المطعم مغلق لأعمال الصيانة');
});
