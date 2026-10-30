import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminOffers,
  getAdminOffer,
  createAdminOffer,
  updateAdminOffer,
  deleteAdminOffer,
} from '../src/services/adminOffersService.js';
import {
  getAdminSettings,
  updateAdminSettings,
} from '../src/services/adminSettingsService.js';

const mockResponse = (data, status = 200, success = true, error = null) => {
  return new Response(JSON.stringify({ success, data, error, meta: { serverTime: new Date().toISOString() } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

test('getAdminOffers fetches offers list with same-origin credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/offers');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse([{ id: 'off1', title: 'عرض الأسبوع', offerPrice: 35 }]);
  });

  const list = await getAdminOffers();
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'عرض الأسبوع');
  assert.equal(list[0].offerPrice, 35);
});

test('createAdminOffer sends CSRF token and returns created offer', async (t) => {
  let headersSent;
  let bodySent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/offers');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    headersSent = options.headers;
    bodySent = JSON.parse(options.body);
    return mockResponse({ id: 'off2', title: 'عرض التوفير', slug: 'ard-tawfeer' }, 201);
  });

  const payload = {
    title: 'عرض التوفير',
    productId: 'prod123',
    originalPrice: 50,
    offerPrice: 40,
    startDate: '2026-10-30T10:00:00.000Z',
    endDate: '2026-11-05T10:00:00.000Z',
  };
  const result = await createAdminOffer(payload, 'csrf-token-xyz');
  assert.equal(headersSent['X-CSRF-Token'], 'csrf-token-xyz');
  assert.equal(bodySent.title, 'عرض التوفير');
  assert.equal(result.id, 'off2');
  assert.equal(result.slug, 'ard-tawfeer');
});

test('updateAdminOffer and deleteAdminOffer invoke correct endpoints with CSRF', async (t) => {
  let updateHeaders, deleteHeaders;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'PATCH') {
      assert.equal(url, '/api/admin/offers/off123');
      updateHeaders = options.headers;
      return mockResponse({ id: 'off123', isActive: false });
    }
    if (options.method === 'DELETE') {
      assert.equal(url, '/api/admin/offers/off123');
      deleteHeaders = options.headers;
      return mockResponse({ deleted: true, id: 'off123' });
    }
    throw new Error('Unexpected method');
  });

  const updated = await updateAdminOffer('off123', { isActive: false }, 'csrf-token-patch');
  assert.equal(updateHeaders['X-CSRF-Token'], 'csrf-token-patch');
  assert.equal(updated.isActive, false);

  const deleted = await deleteAdminOffer('off123', 'csrf-token-del');
  assert.equal(deleteHeaders['X-CSRF-Token'], 'csrf-token-del');
  assert.equal(deleted.deleted, true);
});

test('getAdminSettings and updateAdminSettings communicate with store endpoints', async (t) => {
  let patchHeaders, patchBody;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!options.method || options.method === 'GET') {
      assert.equal(url, '/api/admin/settings');
      return mockResponse({ restaurantName: 'مطعم ومطبخ العائلة', isOpen: true });
    }
    if (options.method === 'PATCH') {
      assert.equal(url, '/api/admin/settings');
      patchHeaders = options.headers;
      patchBody = JSON.parse(options.body);
      return mockResponse({ restaurantName: 'مطعم ومطبخ العائلة', isOpen: false });
    }
    throw new Error('Unexpected method');
  });

  const settings = await getAdminSettings();
  assert.equal(settings.restaurantName, 'مطعم ومطبخ العائلة');
  assert.equal(settings.isOpen, true);

  const updated = await updateAdminSettings({ isOpen: false }, 'csrf-token-settings');
  assert.equal(patchHeaders['X-CSRF-Token'], 'csrf-token-settings');
  assert.equal(patchBody.isOpen, false);
  assert.equal(updated.isOpen, false);
});
