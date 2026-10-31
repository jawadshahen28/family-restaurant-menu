import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const TEST_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWM4ISf3HwAEugIEHAAUUwAAAABJRU5ErkJggg==', 'base64');
export const testCloudinaryConfig = { cloudName: 'test-cloud', apiKey: 'mock-cloudinary-key', apiSecret: 'mock-cloudinary-secret' };

export function createTestCloudinary() {
  const assets = new Map();
  const events = [];
  let version = 1700000000;
  const fake = { assets, events, failUpload: false, failDelete: false, beforeDelete: null };
  fake.fetch = async (url, options) => {
    assert.match(url, /^https:\/\/api\.cloudinary\.com\/v1_1\/test-cloud\/image\/(upload|destroy)$/);
    const form = options.body;
    assert.equal(form.get('api_key'), testCloudinaryConfig.apiKey);
    const signed = [...form.entries()].filter(([key]) => !['file', 'api_key', 'signature'].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
    assert.equal(form.get('signature'), createHash('sha1').update(signed + testCloudinaryConfig.apiSecret).digest('hex'));
    const id = form.get('public_id');
    if (url.endsWith('/upload')) {
      if (fake.failUpload) return new Response('{}', { status: 503 });
      assert.equal(form.get('overwrite'), 'false');
      assert.match(id, /^family_restaurant\/(products|categories|offers)\/[a-f0-9-]+$/);
      assert.match(form.get('file'), /^data:image\/(png|jpeg|webp);base64,/);
      const asset = { public_id: id, version: ++version, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v${version}/${id}.png` };
      assets.set(id, asset);
      events.push({ action: 'upload', id });
      return Response.json(asset);
    }
    assert.equal(form.get('invalidate'), 'true');
    if (fake.failDelete) return new Response('{}', { status: 503 });
    await fake.beforeDelete?.(id);
    const existed = assets.delete(id);
    events.push({ action: 'destroy', id });
    return Response.json({ result: existed ? 'ok' : 'not found' });
  };
  return fake;
}
