import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('the PWA leaves provider images, legacy uploads and API requests to the browser network stack', () => {
  const handlers = {};
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: { location: { origin: 'https://menu.example.com' }, addEventListener(name, handler) { handlers[name] = handler; } },
    fetch: () => Promise.resolve({ status: 200 }),
  });
  for (const url of ['https://res.cloudinary.com/test-cloud/image/upload/v123/family_restaurant/products/test.png', 'https://menu.example.com/uploads/img-old.png', 'https://menu.example.com/api/products']) {
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', url }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});
