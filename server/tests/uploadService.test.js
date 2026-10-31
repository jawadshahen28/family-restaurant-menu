import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createUploadService } from '../src/services/uploadService.js';
import { createTestCloudinary, testCloudinaryConfig, TEST_PNG } from '../../tests/helpers/cloudinary.js';

const input = { data: TEST_PNG.toString('base64'), mimeType: 'image/png', folder: 'products' };

test('production requires Cloudinary and never writes a local fallback on missing keys or upstream failure', async () => {
  const directory = path.resolve('.cache/no-production-image-fallback');
  const missing = createUploadService({ nodeEnv: 'production', cloudinary: {}, uploadsDir: directory });
  await assert.rejects(missing.uploadImage(input), error => error.code === 'CLOUDINARY_NOT_CONFIGURED');
  const fake = createTestCloudinary(); fake.failUpload = true;
  const failing = createUploadService({ nodeEnv: 'production', cloudinary: testCloudinaryConfig, fetcher: fake.fetch, uploadsDir: directory });
  await assert.rejects(failing.uploadImage(input), error => error.code === 'CLOUDINARY_REQUEST_FAILED');
  assert.equal(fs.existsSync(directory), false);
});

test('Cloudinary uploads are unique and versioned, with authenticated metadata that rejects previews and tampering', async () => {
  const fake = createTestCloudinary();
  const service = createUploadService({ nodeEnv: 'production', cloudinary: testCloudinaryConfig, fetcher: fake.fetch });
  const first = await service.uploadImage(input, 'test-admin');
  const second = await service.uploadImage(input, 'test-admin');
  assert.notEqual(first.imagePublicId, second.imagePublicId);
  assert.notEqual(first.imageUrl, second.imageUrl);
  assert.match(first.imageUrl, new RegExp(`/v${first.imageVersion}/`));
  const saved = service.prepareImage({ ...first, name: 'test product' }, {}, 'test-admin');
  assert.equal(saved.image, first.imageUrl);
  assert.equal(saved.imagePublicId, first.imagePublicId);
  assert.equal('imageUploadToken' in saved, false);
  assert.equal(JSON.stringify(first).includes(testCloudinaryConfig.apiSecret), false);
  assert.throws(() => service.prepareImage({ ...first, imagePublicId: 'family_restaurant/another-image' }, {}, 'test-admin'), error => error.code === 'INVALID_IMAGE_UPLOAD');
  assert.throws(() => service.prepareImage(first, {}, 'another-admin'), error => error.code === 'INVALID_IMAGE_UPLOAD');
  assert.throws(() => service.prepareImage({ image: 'blob:https://example.com/local-preview' }), error => error.code === 'IMAGE_UPLOAD_REQUIRED');
  assert.throws(() => service.prepareImage({ image: '/uploads/img-local.png' }), error => error.code === 'IMAGE_UPLOAD_REQUIRED');
  await service.deleteImage({ ...first, cloudName: 'test-cloud' });
  assert.equal(fake.assets.has(first.imagePublicId), false);
});

test('development without Cloudinary retains a real local upload and validates image content', async () => {
  const cache = path.resolve('.cache'); fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, 'local-image-test-'));
  try {
    const service = createUploadService({ nodeEnv: 'development', cloudinary: {}, uploadsDir: directory });
    const uploaded = await service.uploadImage(input, 'test-admin');
    assert.match(uploaded.imageUrl, /^\/uploads\/img-/);
    assert.deepEqual(fs.readFileSync(path.join(directory, path.basename(uploaded.imageUrl))), TEST_PNG);
    await assert.rejects(service.uploadImage({ ...input, data: Buffer.from('not an image').toString('base64') }), error => error.code === 'INVALID_IMAGE');
  } finally {
    assert.ok(directory.startsWith(cache + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
