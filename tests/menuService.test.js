import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearMenuCache, getMenu } from '../src/services/menuService.js';
import { updateAdminProduct } from '../src/services/adminCatalogService.js';

beforeEach(() => clearMenuCache());
function reply(url, version) {
  const data = url === '/api/products' ? [{ id: 'test-product', imageUrl: `https://example.com/image-${version}.png` }] : url === '/api/store' ? { isOpen: true } : [];
  return Response.json({ success: true, data, meta: { serverTime: new Date().toISOString() } });
}

test('saving an image invalidates the menu cache before its normal expiry', async t => {
  let version = 1;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'PATCH') return Response.json({ success: true, data: { id: 'test-product', imageUrl: 'https://example.com/image-2.png' } });
    return reply(url, version);
  });
  assert.equal((await getMenu()).products[0].imageUrl, 'https://example.com/image-1.png');
  version = 2;
  assert.equal((await getMenu()).products[0].imageUrl, 'https://example.com/image-1.png');
  await updateAdminProduct('test-product', { image: 'https://example.com/image-2.png' }, 'mock-csrf');
  assert.equal((await getMenu()).products[0].imageUrl, 'https://example.com/image-2.png');
});

test('an older in-flight menu response cannot replace data fetched after an image save', async t => {
  const delayed = [];
  let oldRequests = true;
  t.mock.method(globalThis, 'fetch', async url => {
    if (oldRequests) return new Promise(resolve => delayed.push(() => resolve(reply(url, 1))));
    return reply(url, 2);
  });
  const oldMenu = getMenu();
  assert.equal(delayed.length, 4);
  clearMenuCache(); oldRequests = false;
  const currentMenu = await getMenu();
  delayed.forEach(resolve => resolve());
  assert.equal(currentMenu.products[0].imageUrl, 'https://example.com/image-2.png');
  assert.equal((await oldMenu).products[0].imageUrl, 'https://example.com/image-2.png');
  assert.equal((await getMenu()).products[0].imageUrl, 'https://example.com/image-2.png');
});
