import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { createApp } from '../src/app.js';
import { createUploadService } from '../src/services/uploadService.js';
import { hashPassword } from '../src/utils/auth.js';
import { createTestCloudinary, testCloudinaryConfig, TEST_PNG } from '../../tests/helpers/cloudinary.js';

let mongo, connection, models, repository, app, fake, cookie, csrf, category, product;
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve('.cache/mongodb-binaries') }, instance: { dbName: 'image_pipeline_test' } });
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: 'image_pipeline_test' }).asPromise();
  models = createModels(connection); await ensureIndexes(models);
});
beforeEach(async () => {
  await Promise.all(Object.values(models).map(model => model.deleteMany({})));
  repository = createRepository(models); fake = createTestCloudinary();
  app = createApp({ repository, config: { allowedOrigins: [], nodeEnv: 'production', trustProxy: 1 }, logger: { info() {}, error() {} }, limiter: { adminLogin: 100 }, uploadService: createUploadService({ nodeEnv: 'production', cloudinary: testCloudinaryConfig, fetcher: fake.fetch }) });
  await models.Admin.create({ username: 'image-test-admin', passwordHash: await hashPassword('test-only-password') });
  const login = await request(app).post('/api/admin/login').send({ username: 'image-test-admin', password: 'test-only-password' });
  cookie = login.headers['set-cookie'][0].split(';')[0]; csrf = login.body.data.csrfToken;
  category = await models.Category.create({ name: 'فئة اختبار', slug: 'image-test', image: '/images/fries.webp' });
  product = await models.Product.create({ name: 'منتج اختبار', slug: 'image-product', price: 35, categoryId: category._id, image: '/images/fries.webp', isFeatured: true });
});
after(async () => { await connection?.close(); await mongo?.stop(); });
const authorized = (method, url) => request(app)[method](url).set('Cookie', cookie).set('X-CSRF-Token', csrf);
async function upload(folder = 'products') {
  const response = await authorized('post', '/api/admin/upload').send({ data: TEST_PNG.toString('base64'), mimeType: 'image/png', folder });
  assert.equal(response.status, 201); return response.body.data;
}

test('product image replaces twice, persists metadata, updates inherited offers, and is deleted only after MongoDB saves', async () => {
  const first = await upload();
  assert.equal((await authorized('patch', `/api/admin/products/${product._id}`).send(first)).status, 200);
  const offer = await models.Offer.create({ slug: 'legacy-copy', title: 'عرض اختبار', productId: product._id, image: first.imageUrl, originalPrice: 35, offerPrice: 30, isActive: true, startDate: new Date(Date.now() - 10000), endDate: new Date(Date.now() + 60000) });
  assert.equal((await authorized('patch', `/api/admin/offers/${offer._id}`).send({ title: 'عرض اختبار محدث' })).status, 200);
  assert.equal((await models.Offer.findById(offer._id)).image, '');
  const second = await upload();
  assert.equal(fake.assets.has(first.imagePublicId), true);
  fake.beforeDelete = async id => { const saved = await models.Product.findById(product._id); assert.equal(saved.imageUrl, second.imageUrl); assert.equal(id, first.imagePublicId); };
  const saved = await authorized('patch', `/api/admin/products/${product._id}`).send(second);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.imageUrl, second.imageUrl);
  assert.equal(saved.body.data.imagePublicId, second.imagePublicId);
  assert.equal(fake.assets.has(first.imagePublicId), false);
  assert.equal(fake.assets.has(second.imagePublicId), true);
  assert.equal((await models.Offer.findById(offer._id)).image, '');
  const menu = await request(app).get('/api/products');
  assert.equal(menu.body.data[0].image, second.imageUrl);
  assert.equal(menu.body.data[0].imageUrl, second.imageUrl);
  assert.equal(menu.headers['cache-control'], 'no-store');
  assert.equal((await request(app).get('/api/offers')).body.data[0].imageUrl, second.imageUrl);
});

test('categories and custom offer images save canonical URLs and metadata independently of product images', async () => {
  const first = await upload('categories');
  assert.equal((await authorized('patch', `/api/admin/categories/${category._id}`).send(first)).status, 200);
  const second = await upload('categories');
  assert.equal((await authorized('patch', `/api/admin/categories/${category._id}`).send(second)).status, 200);
  assert.equal((await request(app).get('/api/categories')).body.data[0].imageUrl, second.imageUrl);
  assert.equal(fake.assets.has(first.imagePublicId), false);
  const image = await upload('offers');
  const created = await authorized('post', '/api/admin/offers').send({ ...image, title: 'عرض بصورة خاصة', productId: String(product._id), originalPrice: 35, offerPrice: 30, isActive: true, startDate: new Date(Date.now() - 10000).toISOString(), endDate: new Date(Date.now() + 60000).toISOString() });
  assert.equal(created.status, 201);
  assert.equal((await request(app).get('/api/offers')).body.data[0].imageUrl, image.imageUrl);
  const replacement = await upload('offers');
  assert.equal((await authorized('patch', `/api/admin/offers/${created.body.data.id}`).send(replacement)).status, 200);
  assert.equal((await request(app).get('/api/offers')).body.data[0].image, replacement.imageUrl);
  assert.equal(fake.assets.has(image.imagePublicId), false);
});

test('failed database writes preserve the old asset; failed Cloudinary deletion is durably retried', async () => {
  const old = await upload(); await authorized('patch', `/api/admin/products/${product._id}`).send(old);
  const next = await upload();
  const update = repository.updateProduct; repository.updateProduct = async () => { throw new Error('Simulated database failure'); };
  assert.equal((await authorized('patch', `/api/admin/products/${product._id}`).send(next)).status, 500);
  assert.equal((await models.Product.findById(product._id)).imageUrl, old.imageUrl);
  assert.equal(fake.assets.has(old.imagePublicId), true);
  repository.updateProduct = update; fake.failDelete = true;
  assert.equal((await authorized('patch', `/api/admin/products/${product._id}`).send(next)).status, 200);
  assert.equal((await models.Product.findById(product._id)).imageUrl, next.imageUrl);
  assert.equal(await models.ImageCleanupJob.countDocuments(), 1);
  fake.failDelete = false;
  await models.ImageCleanupJob.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  await app.locals.imageService.cleanup();
  assert.equal(fake.assets.has(old.imagePublicId), false);
  assert.equal(await models.ImageCleanupJob.countDocuments(), 0);
});

test('shared images are retained until their final catalog reference is removed', async () => {
  const shared = await upload(); await authorized('patch', `/api/admin/products/${product._id}`).send(shared);
  const other = await models.Category.create({ name: 'صورة مشتركة', slug: 'shared-image', image: shared.imageUrl, imageUrl: shared.imageUrl, imagePublicId: shared.imagePublicId, imageVersion: shared.imageVersion });
  const next = await upload(); await authorized('patch', `/api/admin/products/${product._id}`).send(next);
  assert.equal(fake.assets.has(shared.imagePublicId), true);
  assert.equal((await authorized('delete', `/api/admin/categories/${other._id}`)).status, 200);
  assert.equal(fake.assets.has(shared.imagePublicId), false);
});

test('creating categories, products and offers persists uploaded metadata and rejects forged ownership', async () => {
  const categoryImage = await upload('categories');
  const createdCategory = await authorized('post', '/api/admin/categories').send({ ...categoryImage, name: 'فئة بصورة جديدة' });
  assert.equal(createdCategory.status, 201);
  assert.equal(createdCategory.body.data.imagePublicId, categoryImage.imagePublicId);
  const productImage = await upload('products');
  const createdProduct = await authorized('post', '/api/admin/products').send({ ...productImage, name: 'وجبة بصورة جديدة', price: 40, categoryId: createdCategory.body.data.id });
  assert.equal(createdProduct.status, 201);
  assert.equal(createdProduct.body.data.imageUrl, productImage.imageUrl);
  const forged = await authorized('patch', `/api/admin/products/${createdProduct.body.data.id}`).send({ ...productImage, imagePublicId: 'family_restaurant/forged' });
  assert.equal(forged.status, 400);
  assert.equal((await models.Product.findById(createdProduct.body.data.id)).imagePublicId, productImage.imagePublicId);
  assert.equal(fake.assets.has(productImage.imagePublicId), true);
});

test('availability-only PATCH requests preserve images, metadata and other omitted fields', async () => {
  const productImage = await upload('products');
  await authorized('patch', `/api/admin/products/${product._id}`).send(productImage);
  const categoryImage = await upload('categories');
  await authorized('patch', `/api/admin/categories/${category._id}`).send(categoryImage);
  for (const active of [false, true]) {
    assert.equal((await authorized('patch', `/api/admin/products/${product._id}`).send({ isAvailable: active })).status, 200);
    assert.equal((await authorized('patch', `/api/admin/categories/${category._id}`).send({ isActive: active })).status, 200);
    const savedProduct = await models.Product.findById(product._id);
    const savedCategory = await models.Category.findById(category._id);
    assert.equal(savedProduct.imageUrl, productImage.imageUrl);
    assert.equal(savedProduct.imagePublicId, productImage.imagePublicId);
    assert.equal(savedProduct.isFeatured, true);
    assert.equal(savedCategory.imageUrl, categoryImage.imageUrl);
    assert.equal(savedCategory.imagePublicId, categoryImage.imagePublicId);
    assert.equal(fake.assets.has(productImage.imagePublicId), true);
    assert.equal(fake.assets.has(categoryImage.imagePublicId), true);
  }
});
