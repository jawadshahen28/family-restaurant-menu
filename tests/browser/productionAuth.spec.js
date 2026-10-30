import { test, expect, models } from './fixtures.js';
import { hashPassword } from '../../server/src/utils/auth.js';

test.describe('Production HTTPS admin sessions', () => {
  test.skip(process.env.FAMILY_TEST_PRODUCTION !== 'true', 'Run with npm run test:production');

  test.beforeEach(async () => {
    await models.Admin.create({ username: 'production-test-owner', passwordHash: await hashPassword('test-only-password'), name: 'مدير الاختبار' });
  });

  async function signIn(page) {
    await page.goto('/admin/login');
    await page.locator('#username').fill('production-test-owner');
    await page.locator('#password').fill('test-only-password');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  }

  test('real secure cookies survive reloads and new tabs across all admin areas without browser token storage', async ({ page, context, baseURL }) => {
    const apiRequests = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    const cookie = (await context.cookies()).find(item => item.name === 'admin_session');
    expect(Boolean(cookie)).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.domain).toBe('127.0.0.1');
    expect(await page.evaluate(() => document.cookie.includes('admin_session='))).toBe(false);

    for (const area of ['categories', 'products', 'offers', 'settings', 'orders']) {
      const loaded = page.waitForResponse(response => new URL(response.url()).pathname === `/api/admin/${area}` && response.request().method() === 'GET');
      await page.goto(`/admin/${area}`);
      expect((await loaded).status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/admin/${area}$`));
    }
    const restored = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/me');
    await page.reload();
    const session = await (await restored).json();
    expect(session.data.authenticated).toBe(true);
    const secretsAbsent = await page.evaluate(([sessionId, csrf]) => {
      const storage = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
      return !storage.includes(sessionId) && !storage.includes(csrf);
    }, [cookie.value, session.data.csrfToken]);
    expect(secretsAbsent).toBe(true);
    expect(JSON.stringify(session).includes(cookie.value)).toBe(false);
    expect(apiRequests.length).toBeGreaterThan(6);
    expect(apiRequests.every(url => new URL(url).origin === new URL(baseURL).origin)).toBe(true);

    const tab = await context.newPage();
    const tabSession = tab.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/me');
    await tab.goto('/admin/categories');
    expect((await tabSession).status()).toBe(200);
    await expect(tab).toHaveURL(/\/admin\/categories$/);

    const logout = await page.request.post('/api/admin/logout', { headers: { 'X-CSRF-Token': session.data.csrfToken } });
    expect(logout.status()).toBe(200);
    expect((await context.cookies()).some(item => item.name === 'admin_session')).toBe(false);
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('a successful login response without a usable cookie never opens protected pages', async ({ page, context }) => {
    await page.route('**/api/admin/me', async route => {
      await context.clearCookies();
      const headers = { ...route.request().headers() };
      delete headers.cookie;
      await route.continue({ headers });
    });
    await signIn(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText('مرحبًا بك', { exact: true })).toHaveCount(0);
  });

  test('late unauthenticated startup checks cannot erase a newly verified session', async ({ page }) => {
    const startupChecks = [];
    let loggingIn = false;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/admin/login') loggingIn = true; });
    await page.route('**/api/admin/me', async route => {
      if (loggingIn) return route.continue();
      await new Promise(resolve => startupChecks.push(async () => {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Test startup request was unauthenticated' } }) });
        resolve();
      }));
    });
    try {
      await signIn(page);
      await expect(page).toHaveURL(/\/admin$/);
      expect(startupChecks.length).toBeGreaterThan(0);
      await Promise.all(startupChecks.splice(0).map(release => release()));
      await page.getByRole('button', { name: 'الفئات إدارة التصنيفات' }).click();
      await expect(page).toHaveURL(/\/admin\/categories$/);
      await expect(page.getByRole('heading', { name: 'الفئات', exact: true })).toBeVisible();
    } finally {
      await Promise.all(startupChecks.splice(0).map(release => release()));
    }
  });
});
