import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminOrders,
  getAdminOrder,
  updateAdminOrderStatus,
} from '../src/services/adminOrdersService.js';

const mockResponse = (data, status = 200, success = true, error = null) => {
  return new Response(JSON.stringify({ success, data, error, meta: { serverTime: new Date().toISOString() } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

test('getAdminOrders forwards status filter and pagination', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/orders?status=new&page=1&limit=20');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse({ orders: [{ id: 'ord1', status: 'new' }], total: 1, newCount: 1 });
  });

  const result = await getAdminOrders({ status: 'new', page: 1, limit: 20 });
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].id, 'ord1');
  assert.equal(result.newCount, 1);
});

test('getAdminOrder retrieves single order details', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/orders/ord123');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse({ id: 'ord123', orderNumber: 'FAM-123', status: 'new' });
  });

  const order = await getAdminOrder('ord123');
  assert.equal(order.id, 'ord123');
  assert.equal(order.orderNumber, 'FAM-123');
});

test('updateAdminOrderStatus sends patch payload with CSRF token', async (t) => {
  let headersSent;
  let bodySent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/orders/ord123/status');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    headersSent = options.headers;
    bodySent = JSON.parse(options.body);
    return mockResponse({ id: 'ord123', status: 'received' });
  });

  const updated = await updateAdminOrderStatus('ord123', 'received', 'csrf-token-123');
  assert.equal(headersSent['X-CSRF-Token'], 'csrf-token-123');
  assert.equal(bodySent.status, 'received');
  assert.equal(updated.status, 'received');
});
