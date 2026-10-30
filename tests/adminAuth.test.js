import test from 'node:test';
import assert from 'node:assert/strict';
import { loginAdmin, getAdminMe, logoutAdmin } from '../src/services/adminService.js';

const mockResponse = (data, status = 200, success = true, error = null) => {
  return new Response(JSON.stringify({ success, data, error, meta: { serverTime: new Date().toISOString() } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

test('loginAdmin posts credentials and returns authenticated user and CSRF token', async (t) => {
  let requestSent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/login');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    requestSent = JSON.parse(options.body);
    return mockResponse({
      user: { id: 'admin123', username: 'owner', name: 'مالك المطعم', role: 'owner' },
      csrfToken: 'mock-csrf-token-xyz',
    }, 200);
  });

  const result = await loginAdmin('owner', 'secret123');
  assert.equal(requestSent.username, 'owner');
  assert.equal(requestSent.password, 'secret123');
  assert.equal(result.user.username, 'owner');
  assert.equal(result.csrfToken, 'mock-csrf-token-xyz');
});

test('loginAdmin maps server error responses to ApiClientError', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    return mockResponse(null, 401, false, {
      code: 'INVALID_CREDENTIALS',
      message: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    });
  });

  await assert.rejects(
    loginAdmin('baduser', 'badpass'),
    (err) => err.code === 'INVALID_CREDENTIALS' && err.message.includes('غير صحيحة')
  );
});

test('getAdminMe retrieves current active admin session', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/me');
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    return mockResponse({
      authenticated: true,
      user: { id: 'admin123', username: 'owner', name: 'مالك المطعم', role: 'owner' },
      csrfToken: 'token-abc-123',
    });
  });

  const result = await getAdminMe();
  assert.equal(result.authenticated, true);
  assert.equal(result.user.username, 'owner');
  assert.equal(result.csrfToken, 'token-abc-123');
});

test('logoutAdmin sends X-CSRF-Token header and invalidates session', async (t) => {
  let headersSent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/admin/logout');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    headersSent = options.headers;
    return mockResponse({ loggedOut: true });
  });

  const result = await logoutAdmin('my-csrf-token');
  assert.equal(headersSent['X-CSRF-Token'], 'my-csrf-token');
  assert.equal(result.loggedOut, true);
});
