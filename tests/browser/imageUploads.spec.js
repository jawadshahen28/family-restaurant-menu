import { test, expect, models } from './fixtures.js';
import { hashPassword } from '../../server/src/utils/auth.js';
import { TEST_PNG } from '../helpers/cloudinary.js';

test.describe('Cloudinary image persistence and public menu synchronization', () => {
  test.skip(process.env.FAMILY_TEST_PRODUCTION !== 'true', 'Run the isolated production image provider with npm run test:production');
  test.beforeEach(async ({ context, page }) => {
    await context.route('https://res.cloudinary.com/test-cloud/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: TEST_PNG }));
    await models.Admin.create({ username: 'image-test-admin', passwordHash: await hashPassword('test-only-password') });
    await page.goto('/admin/login');
    await page.locator('#username').fill('image-test-admin');
    await page.locator('#password').fill('test-only-password');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  async function upload(page, name) {
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/upload');
    await page.locator('#image-upload-input').setInputFiles({ name, mimeType: 'image/png', buffer: TEST_PNG });
    const response = await completed;
    expect(response.status()).toBe(201);
    const asset = (await response.json()).data;
    expect(asset.imagePublicId).toMatch(/^family_restaurant\//);
    expect(asset.imageUrl).toContain(`/v${asset.imageVersion}/`);
    await expect(page.locator('form img').first()).toHaveAttribute('src', asset.imageUrl);
    return asset;
  }
  async function save(page, endpoint, label = 'حفظ التعديلات') {
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && ['POST', 'PATCH'].includes(response.request().method()));
    await page.getByRole('button', { name: label, exact: true }).click();
    expect((await saved).status()).toBe(200);
  }

  for (const [device, width, height] of [['phone', 390, 844], ['ipad', 834, 1194], ['desktop', 1440, 1000]]) {
    test(`product uploads twice and updates an already-open public menu without refresh: ${device}`, async ({ page, context }) => {
      await page.setViewportSize({ width, height });
      const product = await models.Product.findOne({ slug: 'broast-4' });
      const menu = await context.newPage();
      await menu.goto('/');
      const publicImage = menu.locator('.featured-section [data-product-id="broast-4"] img');
      await expect(publicImage).toHaveAttribute('src', product.image);
      await page.goto(`/admin/products/${product._id}/edit`);
      const first = await upload(page, `${device}-first.png`);
      await save(page, `/api/admin/products/${product._id}`);
      await expect(publicImage).toHaveAttribute('src', first.imageUrl);
      await menu.bringToFront();
      await publicImage.scrollIntoViewIfNeeded();
      await expect(publicImage).toHaveJSProperty('naturalWidth', 1);
      await page.bringToFront();
      await page.goto(`/admin/products/${product._id}/edit`);
      await expect(page.locator('form img').first()).toHaveAttribute('src', first.imageUrl);
      const second = await upload(page, `${device}-second.png`);
      await save(page, `/api/admin/products/${product._id}`);
      await expect(publicImage).toHaveAttribute('src', second.imageUrl);
      expect(second.imageUrl).not.toBe(first.imageUrl);
      const saved = await models.Product.findById(product._id).lean();
      expect(saved.imageUrl).toBe(second.imageUrl);
      expect(saved.imagePublicId).toBe(second.imagePublicId);
      expect(saved.imageVersion).toBe(second.imageVersion);
      await menu.reload();
      await expect(publicImage).toHaveAttribute('src', second.imageUrl);
    });
  }

  test('category and offer images use the same saved Cloudinary URLs in admin and public views', async ({ page, context }) => {
    const category = await models.Category.findOne({ slug: 'broast' });
    const product = await models.Product.findOne({ slug: 'broast-4' });
    const menu = await context.newPage(); await menu.goto('/');
    await expect(menu.locator('.category-card[href="#category-broast"] img')).toBeVisible();
    await page.goto(`/admin/categories/${category._id}/edit`);
    const categoryImage = await upload(page, 'category.png');
    await save(page, `/api/admin/categories/${category._id}`);
    await expect(menu.locator('.category-card[href="#category-broast"] img')).toHaveAttribute('src', categoryImage.imageUrl);
    const offer = await models.Offer.create({ slug: 'image-browser-offer', title: 'عرض الصور', productId: product._id, originalPrice: 35, offerPrice: 30, isActive: true, startDate: new Date(Date.now() - 10000), endDate: new Date(Date.now() + 600000) });
    await menu.reload();
    const offerImage = menu.locator('.offers-section [data-product-id="broast-4"] img');
    await expect(offerImage).toHaveAttribute('src', product.image);
    await page.goto(`/admin/offers/${offer._id}/edit`);
    const customImage = await upload(page, 'offer.png');
    await save(page, `/api/admin/offers/${offer._id}`, 'حفظ العرض');
    await expect(offerImage).toHaveAttribute('src', customImage.imageUrl);
    await page.goto(`/admin/offers/${offer._id}/edit`);
    await expect(page.locator('form img').first()).toHaveAttribute('src', customImage.imageUrl);
  });

  test('saving is disabled until the upload finishes and a failed upload restores the saved image', async ({ page }) => {
    const product = await models.Product.findOne({ slug: 'broast-4' });
    await page.goto(`/admin/products/${product._id}/edit`);
    let release, markStarted;
    const heldUpload = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { markStarted = resolve; });
    await page.route('**/api/admin/upload', async route => {
      markStarted();
      await heldUpload;
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'CLOUDINARY_REQUEST_FAILED', message: 'تعذّر رفع الصورة للاختبار' } }) });
    });
    await page.locator('#image-upload-input').setInputFiles({ name: 'failed.png', mimeType: 'image/png', buffer: TEST_PNG });
    await started;
    await expect(page.getByRole('button', { name: 'حفظ التعديلات', exact: true })).toBeDisabled();
    release();
    await expect(page.getByText('تعذّر رفع الصورة للاختبار')).toBeVisible();
    await expect(page.locator('form img').first()).toHaveAttribute('src', product.image);
    expect((await models.Product.findById(product._id)).image).toBe(product.image);
  });
});
