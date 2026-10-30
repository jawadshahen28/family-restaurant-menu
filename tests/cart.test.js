import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../src/data/products.js';
import { CART_STORAGE_KEY, cartReducer, getCartItems, getCartTotals, normalizeCart, readCart } from '../src/utils/cart.js';

test('adding, increasing, decreasing and removing products keeps correct totals', () => {
  let cart = cartReducer([], { type: 'change', productId: 'broast-4', delta: 1 });
  cart = cartReducer(cart, { type: 'change', productId: 'broast-4', delta: 1 });
  cart = cartReducer(cart, { type: 'change', productId: 'hot-wings', delta: 1 });
  assert.deepEqual(getCartTotals(getCartItems(cart, products)), { count: 3, total: 98 });
  cart = cartReducer(cart, { type: 'change', productId: 'broast-4', delta: -1 });
  assert.deepEqual(getCartTotals(getCartItems(cart, products)), { count: 2, total: 63 });
  cart = cartReducer(cart, { type: 'change', productId: 'hot-wings', delta: -1 });
  assert.deepEqual(cart, [{ productId: 'broast-4', quantity: 1 }]);
  assert.deepEqual(cartReducer(cart, { type: 'remove', productId: 'broast-4' }), []);
});

test('persisted cart ignores corrupt entries, duplicate IDs and untrusted prices', () => {
  const value = [null, { productId: 'unknown', quantity: 1 },
    { productId: 'broast-4', quantity: 2, price: .01 },
    { productId: 'broast-4', quantity: 5 }, { productId: 'hot-wings', quantity: -1 },
    { productId: 'golden-fries', quantity: 1.5 }, { productId: 'cold-drink', quantity: 10000 }];
  const normalized = normalizeCart(value, products);
  assert.deepEqual(normalized, [{ productId: 'broast-4', quantity: 2 }, { productId: 'cold-drink', quantity: 99 }]);
  assert.deepEqual(getCartTotals(getCartItems(normalized, products)), { count: 101, total: 565 });
  const storage = { getItem: (key) => key === CART_STORAGE_KEY ? JSON.stringify(normalized) : null };
  assert.deepEqual(readCart(storage, products), normalized);
  assert.deepEqual(readCart({ getItem: () => '{broken' }, products), []);
  assert.deepEqual(readCart({ getItem: () => { throw new Error('Storage disabled'); } }, products), []);
});

test('cart quantity stays between zero and 99', () => {
  assert.deepEqual(cartReducer([], { type: 'change', productId: 'broast-4', delta: -1 }), []);
  const cart = [{ productId: 'broast-4', quantity: 99 }];
  assert.equal(cartReducer(cart, { type: 'change', productId: 'broast-4', delta: 1 })[0].quantity, 99);
});

test('available offer prices are applied consistently to cart totals', () => {
  const cart = [{ productId: 'family-meal', quantity: 2 }];
  assert.equal(getCartTotals(getCartItems(cart, products, [{ productId: 'family-meal', offerPrice: 75 }])).total, 150);
  assert.equal(getCartTotals(getCartItems(cart, products)).total, 170);
});

test('saved unavailable products remain visible for removal and explicit checkout validation', () => {
  const catalog = products.map((product) => product.id === 'broast-4' ? { ...product, isAvailable: false } : product);
  const cart = normalizeCart([{ productId: 'broast-4', quantity: 2 }], catalog);
  const items = getCartItems(cart, catalog);
  assert.equal(items.length, 1);
  assert.equal(items[0].isAvailable, false);
  assert.equal(items[0].subtotal, 70);
  assert.deepEqual(cartReducer(cart, { type: 'clear' }), []);
});
