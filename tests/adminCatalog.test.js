import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
} from '../src/services/adminCatalogService.js';

const mockResponse = (data, status = 200, success = true, error = null) => {
  return new Response(JSON.stringify({ success, data, error, meta: { serverTime: new Date().toISOString() } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

test('getAdminCategories fetches category list with same-origin credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/categories');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse([{ id: 'cat1', name: 'بروست', productCount: 3 }]);
  });

  const list = await getAdminCategories();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'بروست');
  assert.equal(list[0].productCount, 3);
});

test('createAdminCategory sends CSRF token and returns created category', async (t) => {
  let headersSent;
  let bodySent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/categories');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    headersSent = options.headers;
    bodySent = JSON.parse(options.body);
    return mockResponse({ id: 'cat2', name: 'مقبلات', slug: 'mqblat' }, 201);
  });

  const result = await createAdminCategory({ name: 'مقبلات', sortOrder: 5 }, 'csrf-token-123');
  assert.equal(headersSent['X-CSRF-Token'], 'csrf-token-123');
  assert.equal(bodySent.name, 'مقبلات');
  assert.equal(result.name, 'مقبلات');
  assert.equal(result.slug, 'mqblat');
});

test('deleteAdminCategory handles 409 conflict when category contains products', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    return mockResponse(null, 409, false, {
      code: 'CATEGORY_IN_USE',
      message: 'لا يمكن حذف الفئة لاحتوائها على 3 من الوجبات.',
    });
  });

  await assert.rejects(
    deleteAdminCategory('cat1', 'csrf-token-123'),
    (err) => err.code === 'CATEGORY_IN_USE' && err.message.includes('لا يمكن حذف الفئة')
  );
});

test('getAdminProducts forwards category and search query parameters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.includes('category=cat1'));
    assert.ok(url.includes('search=%D8%AF%D8%AC%D8%A7%D8%AC')); // دجاج URL encoded
    assert.equal(options.credentials, 'same-origin');
    return mockResponse([{ id: 'p1', name: 'دجاج مقلي', price: 40, isAvailable: true }]);
  });

  const prods = await getAdminProducts({ categoryId: 'cat1', search: 'دجاج' });
  assert.equal(prods.length, 1);
  assert.equal(prods[0].name, 'دجاج مقلي');
});

test('updateAdminProduct sends patch payload with CSRF token', async (t) => {
  let headersSent;
  let bodySent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/products/p1');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    headersSent = options.headers;
    bodySent = JSON.parse(options.body);
    return mockResponse({ id: 'p1', isAvailable: false, price: 45 });
  });

  const updated = await updateAdminProduct('p1', { isAvailable: false, price: 45 }, 'csrf-token-99');
  assert.equal(headersSent['X-CSRF-Token'], 'csrf-token-99');
  assert.equal(bodySent.isAvailable, false);
  assert.equal(updated.price, 45);
});
