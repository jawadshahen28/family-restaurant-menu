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
const config = { allowedOrigins: ['http://localhost:5173'], trustProxy: 0, nodeEnv: 'test' };
const logEntries = [];
const logger = { info(event, fields) { logEntries.push({ event, fields }); }, error(event, fields) { logEntries.push({ event, fields }); } };

before(async () => {
  testUploadsDir = path.resolve('.cache/test-uploads');
  fs.mkdirSync(testUploadsDir, { recursive: true });

  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'family_menu' } });
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
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
    models.Admin.deleteMany({}),
    models.AdminSession.deleteMany({}),
  ]);

  // Seed one admin and login
  const passwordHash = await hashPassword('adminPass123');
  await models.Admin.create({ username: 'owner', passwordHash, name: 'مالك المطعم' });

  const loginRes = await request(app).post('/api/admin/login').send({ username: 'owner', password: 'adminPass123' });
  adminCookie = loginRes.headers['set-cookie'][0];
  csrfToken = loginRes.body.data.csrfToken;
});

after(async () => {
  await connection?.close();
  await mongo?.stop();
  try {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  } catch {}
});

test('unauthenticated or missing CSRF requests are rejected from admin catalog endpoints', async () => {
  // No cookie -> 401
  const noAuth = await request(app).get('/api/admin/categories');
  assert.equal(noAuth.status, 401);

  // Cookie but no CSRF on state change -> 403
  const noCsrf = await request(app).post('/api/admin/categories')
    .set('Cookie', adminCookie)
    .send({ name: 'مقبلات' });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.error.code, 'CSRF_INVALID');
});

test('category creation auto-generates unique slugs and handles duplicate names', async () => {
  const res1 = await request(app).post('/api/admin/categories')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'بروست دجاج', icon: 'drumstick', sortOrder: 1 });
  assert.equal(res1.status, 201);
  assert.ok(res1.body.data.slug);
  assert.match(res1.body.data.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);

  // Duplicate name generates distinct slug with suffix
  const res2 = await request(app).post('/api/admin/categories')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'بروست دجاج', icon: 'drumstick', sortOrder: 2 });
  assert.equal(res2.status, 201);
  assert.notEqual(res1.body.data.slug, res2.body.data.slug);
  assert.equal(res2.body.data.slug, `${res1.body.data.slug}-2`);
});

test('category listing includes accurate product count per category', async () => {
  const cat = await models.Category.create({ name: 'بروست', slug: 'broast', isActive: true });
  await models.Product.create([
    { name: 'وجبة 4 قطع', slug: 'meal-4', price: 30, categoryId: cat._id },
    { name: 'وجبة 8 قطع', slug: 'meal-8', price: 55, categoryId: cat._id },
  ]);

  const res = await request(app).get('/api/admin/categories').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].productCount, 2);
  assert.equal(res.body.data[0].name, 'بروست');
});

test('category deletion safeguard blocks deleting category with products', async () => {
  const cat = await models.Category.create({ name: 'ساندويشات', slug: 'sandwiches', isActive: true });
  await models.Product.create({ name: 'ساندويش فاهيتا', slug: 'fajita', price: 20, categoryId: cat._id });

  // Delete attempt must return 409
  const delRes = await request(app).delete(`/api/admin/categories/${cat._id}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(delRes.status, 409);
  assert.equal(delRes.body.error.code, 'CATEGORY_IN_USE');

  // After removing products, deletion succeeds
  await models.Product.deleteMany({ categoryId: cat._id });
  const okDel = await request(app).delete(`/api/admin/categories/${cat._id}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(okDel.status, 200);
  assert.equal(okDel.body.data.deleted, true);
});

test('product CRUD: validation, category reference, availability toggle, and search filter', async () => {
  const cat = await models.Category.create({ name: 'مشروبات', slug: 'drinks', isActive: true });

  // Create product with invalid category -> 400
  const badCat = await request(app).post('/api/admin/products')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'عصير برتقال', price: 8, categoryId: '507f1f77bcf86cd799439011' });
  assert.equal(badCat.status, 400);

  // Create product with valid category
  const createRes = await request(app).post('/api/admin/products')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: 'عصير برتقال طبيعي', price: 10, categoryId: String(cat._id), description: 'طازج' });
  assert.equal(createRes.status, 201);
  const prodId = createRes.body.data.id;
  assert.equal(createRes.body.data.name, 'عصير برتقال طبيعي');
  assert.equal(createRes.body.data.isAvailable, true);

  // Search filter
  const searchRes = await request(app).get('/api/admin/products?search=برتقال').set('Cookie', adminCookie);
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.data.length, 1);

  // Availability toggle via PATCH
  const patchRes = await request(app).patch(`/api/admin/products/${prodId}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ isAvailable: false, price: 12 });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.data.isAvailable, false);
  assert.equal(patchRes.body.data.price, 12);

  // Filter by availability
  const unavailRes = await request(app).get('/api/admin/products?available=false').set('Cookie', adminCookie);
  assert.equal(unavailRes.status, 200);
  assert.equal(unavailRes.body.data.length, 1);
});

test('product deletion safeguard blocks deleting product referenced in active offer', async () => {
  const cat = await models.Category.create({ name: 'وجبات', slug: 'meals', isActive: true });
  const prod = await models.Product.create({ name: 'وجبة عائلية', slug: 'family-meal', price: 100, categoryId: cat._id });

  // Attach active offer
  await models.Offer.create({
    title: 'عرض العائلة',
    slug: 'family-offer',
    originalPrice: 100,
    offerPrice: 85,
    productId: prod._id,
    startDate: new Date(Date.now() - 3600000),
    endDate: new Date(Date.now() + 86400000),
    isActive: true,
  });

  const delRes = await request(app).delete(`/api/admin/products/${prod._id}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(delRes.status, 409);
  assert.equal(delRes.body.error.code, 'PRODUCT_IN_OFFER');

  // Deactivate offer -> deletion succeeds
  await models.Offer.updateOne({ productId: prod._id }, { isActive: false });
  const okDel = await request(app).delete(`/api/admin/products/${prod._id}`)
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken);
  assert.equal(okDel.status, 200);
  assert.equal(okDel.body.data.deleted, true);
});

test('image upload validates file type and returns persistent URL', async () => {
  // Valid WebP base64
  const sampleBase64 = 'UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAEAcQERGIiP4HAA==';
  const uploadRes = await request(app).post('/api/admin/upload')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ data: sampleBase64, mimeType: 'image/webp', filename: 'test.webp' });
  assert.equal(uploadRes.status, 201);
  assert.ok(uploadRes.body.data.url.startsWith('/uploads/img-'));

  // Invalid mime type
  const badMime = await request(app).post('/api/admin/upload')
    .set('Cookie', adminCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ data: sampleBase64, mimeType: 'application/pdf', filename: 'doc.pdf' });
  assert.equal(badMime.status, 400);
  assert.equal(badMime.body.error.code, 'UNSUPPORTED_IMAGE_TYPE');
});
