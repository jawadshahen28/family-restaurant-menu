import test from 'node:test';
import assert from 'node:assert/strict';
import { submitOrder, loadOrder } from '../src/services/orderService.js';
import { createUUID, createAccessToken } from '../src/utils/identifiers.js';

let sequence = 0;
function fixture() {
  return { checkout: { name: `أحمد ${++sequence}`, phone: '0599123456', fulfillmentType: 'pickup', notes: '' }, items: [{ id: 'broast-4', databaseId: '507f1f77bcf86cd799439011', name: 'بروست ٤ قطع', quantity: 2, price: 35, isAvailable: true, offerId: null }], expectedProductsSubtotal: 70, submissionKey: createUUID() };
}
function orderResult(payload) {
  return { id: '507f1f77bcf86cd799439012', orderNumber: 'FAM-TEST-123', customer: payload.customer, fulfillmentType: payload.fulfillmentType, deliveryAddress: payload.deliveryAddress, notes: payload.notes, items: payload.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: 35, lineTotal: 70, name: 'بروست ٤ قطع' })), productsSubtotal: 70, status: 'confirmed', createdAt: new Date().toISOString() };
}
const response = (data, status = 200) => new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });

test('real order service sends identifiers, quantities and review quotes, then returns backend confirmation', async (t) => {
  const input = fixture(); let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/orders'); assert.equal(options.method, 'POST');
    sent = JSON.parse(options.body);
    return response({ order: orderResult(sent), replayed: false }, 201);
  });
  const result = await submitOrder(input);
  assert.equal(result.status, 'confirmed');
  assert.match(result.confirmationToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sent.items[0].productId, input.items[0].databaseId);
  assert.equal(sent.items[0].expectedUnitPrice, 35);
  assert.equal('price' in sent.items[0], false);
  assert.equal('productsSubtotal' in sent, false);
  assert.equal('status' in sent, false);
  assert.equal(input.items[0].quantity, 2);
});

test('client-side invalid customer data, empty carts and unavailable items never invoke the API', async (t) => {
  let called = false;
  t.mock.method(globalThis, 'fetch', async () => { called = true; });
  const input = fixture();
  await assert.rejects(submitOrder({ ...input, checkout: { ...input.checkout, name: '' } }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(submitOrder({ ...input, items: [] }), { code: 'EMPTY_CART' });
  await assert.rejects(submitOrder({ ...input, items: [{ ...input.items[0], isAvailable: false }] }), { code: 'UNAVAILABLE_PRODUCT' });
  assert.equal(called, false);
});

test('lost network acknowledgements keep the original retry identifier, access token and reviewed payload', async (t) => {
  const input = fixture(); const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent.push(JSON.parse(options.body)); throw new Error('Offline'); });
  await assert.rejects(submitOrder(input), { code: 'NETWORK_ERROR' });
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent.push(JSON.parse(options.body)); return response({ order: orderResult(sent[1]), replayed: true }); });
  const result = await submitOrder({ ...input, items: [{ ...input.items[0], price: 44 }], expectedProductsSubtotal: 88 });
  assert.equal(result.productsSubtotal, 70);
  assert.deepEqual(sent[0], sent[1]);
});

test('changing the logical request after a network failure uses a fresh submission identifier', async (t) => {
  const input = fixture(); let original;
  t.mock.method(globalThis, 'fetch', async (url, options) => { original = JSON.parse(options.body); throw new Error('Offline'); });
  await assert.rejects(submitOrder(input));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const next = JSON.parse(options.body);
    assert.notEqual(next.submissionId, original.submissionId);
    return response({ order: orderResult(next) });
  });
  await submitOrder({ ...input, checkout: { ...input.checkout, name: 'اسم جديد' } });
});

test('Arabic server validation errors are mapped to existing form fields', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'راجع بياناتك', details: { fields: { 'customer.phone': 'رقم الهاتف غير صحيح' } } } }), { status: 422 }));
  await assert.rejects(submitOrder(fixture()), (error) => { assert.equal(error.fields.phone, 'رقم الهاتف غير صحيح'); assert.equal(error.status, 422); return true; });
});

test('invalid API success payloads cannot be treated as a confirmed order', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response({ order: { id: 'invalid-id', status: 'confirmed' } }));
  await assert.rejects(submitOrder(fixture()), { code: 'INVALID_RESPONSE' });
});

test('simultaneous submissions share one HTTP request', async (t) => {
  let count = 0; let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, options) => { count++; await gate; return response({ order: orderResult(JSON.parse(options.body)) }); });
  const input = fixture();
  const a = submitOrder(input); const b = submitOrder(input);
  release();
  assert.equal((await a).id, (await b).id);
  assert.equal(count, 1);
});

test('confirmation retrieval sends its secret only in Authorization and handles absent access safely', async (t) => {
  const token = createAccessToken(); const input = fixture();
  assert.equal(await loadOrder('invalid', token), null);
  assert.equal(await loadOrder('507f1f77bcf86cd799439012', null), null);
  const real = { ...orderResult({ customer: { name: input.checkout.name }, fulfillmentType: 'pickup', items: [{ productId: input.items[0].databaseId, quantity: 2 }], notes: '' }) };
  t.mock.method(globalThis, 'fetch', async (url, options) => { assert.equal(url, '/api/orders/507f1f77bcf86cd799439012'); assert.equal(options.headers.Authorization, `Bearer ${token}`); assert.equal(url.includes(token), false); assert.equal(options.credentials, 'omit'); return response(real); });
  assert.equal((await loadOrder(real.id, token)).orderNumber, real.orderNumber);
});
