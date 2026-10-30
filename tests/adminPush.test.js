import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  urlBase64ToUint8Array,
  checkPushCapabilities,
  getVapidPublicKey,
  getPushStatus,
  subscribeDevice,
  unsubscribeDevice,
} from '../src/services/adminPushService.js';

const mockResponse = (data, status = 200, success = true, error = null) => {
  return new Response(JSON.stringify({ success, data, error, meta: { serverTime: new Date().toISOString() } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

test('web app manifest exists and complies with all PWA requirements', () => {
  const manifestPath = path.resolve('public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest exists in public');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.name, 'إدارة مطعم العائلة');
  assert.equal(manifest.short_name, 'إدارة العائلة');
  assert.equal(manifest.id, '/admin');
  assert.equal(manifest.start_url, '/admin');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.dir, 'rtl');
  assert.equal(manifest.lang, 'ar');
  assert.equal(manifest.theme_color, '#bd0c18');

  // Verify icons
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));

  // Verify generated icon files exist on disk
  for (const icon of manifest.icons) {
    const iconFilePath = path.resolve('public' + icon.src);
    assert.ok(fs.existsSync(iconFilePath), `Icon file ${icon.src} exists`);
  }
});

test('service worker file exists and contains push and notificationclick handlers', () => {
  const swPath = path.resolve('public/sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js exists in public');
  const swContent = fs.readFileSync(swPath, 'utf8');

  assert.ok(swContent.includes("addEventListener('push'"), 'SW handles push events');
  assert.ok(swContent.includes("addEventListener('notificationclick'"), 'SW handles notificationclick events');
  assert.ok(swContent.includes('showNotification'), 'SW displays notifications');
  assert.ok(swContent.includes('/admin/orders'), 'SW default navigation points to admin orders');
});

test('urlBase64ToUint8Array correctly converts VAPID base64 string to Uint8Array', () => {
  const testKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckj0Gy2jx_WQBkp5GER2OiZXGsDUfM';
  const uint8 = urlBase64ToUint8Array(testKey);

  assert.ok(uint8 instanceof Uint8Array);
  assert.equal(uint8.length, 65);
});

test('getVapidPublicKey fetches public key with same-origin credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/push/public-key');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse({ publicKey: 'test_vapid_key_123' });
  });

  const key = await getVapidPublicKey();
  assert.equal(key, 'test_vapid_key_123');
});

test('getPushStatus queries push status with optional endpoint query parameter', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/push/status?endpoint=https%3A%2F%2Fpush.example.com%2Fsub1');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse({ configured: true, isSubscribed: true, deviceCount: 2 });
  });

  const status = await getPushStatus('https://push.example.com/sub1');
  assert.equal(status.configured, true);
  assert.equal(status.isSubscribed, true);
  assert.equal(status.deviceCount, 2);
});

test('subscribeDevice and unsubscribeDevice send CSRF token and correct payloads', async (t) => {
  let subscribeHeaders, subscribeBody;
  let unsubscribeHeaders, unsubscribeBody;

  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/admin/push/subscribe') {
      subscribeHeaders = options.headers;
      subscribeBody = JSON.parse(options.body);
      return mockResponse({ subscribed: true }, 201);
    }
    if (url === '/api/admin/push/unsubscribe') {
      unsubscribeHeaders = options.headers;
      unsubscribeBody = JSON.parse(options.body);
      return mockResponse({ unsubscribed: true });
    }
    throw new Error('Unexpected URL: ' + url);
  });

  const subPayload = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
    keys: { p256dh: 'k1', auth: 'a1' },
    device: { platform: 'iPhone' },
  };

  const subRes = await subscribeDevice(subPayload, 'csrf_token_abc');
  assert.equal(subRes.subscribed, true);
  assert.equal(subscribeHeaders['X-CSRF-Token'], 'csrf_token_abc');
  assert.equal(subscribeBody.endpoint, 'https://fcm.googleapis.com/fcm/send/phone');

  const unsubRes = await unsubscribeDevice('https://fcm.googleapis.com/fcm/send/phone', 'csrf_token_abc');
  assert.equal(unsubRes.unsubscribed, true);
  assert.equal(unsubscribeHeaders['X-CSRF-Token'], 'csrf_token_abc');
  assert.equal(unsubscribeBody.endpoint, 'https://fcm.googleapis.com/fcm/send/phone');
});
