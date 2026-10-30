import { test, expect, models } from './fixtures.js';

test('Arabic menu, category navigation, cart totals, quantities, removal and persistence', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'وجباتنا المميّزة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'عرض اليوم' })).toHaveCount(0);
  await expect(page.locator('.cart-summary')).toHaveCount(0);
  await expect(page.locator('.brand-logo img')).toBeVisible();
  const card = page.locator('.featured-section [data-product-id="broast-4"]');
  await card.getByRole('button', { name: 'إضافة بروست ٤ قطع للسلة', exact: true }).click();
  await expect(page.getByRole('status', { name: 'إشعار السلة' })).toContainText('أضفنا بروست');
  await card.getByRole('button', { name: 'زيادة كمية بروست ٤ قطع', exact: true }).click();
  const wings = page.locator('.featured-section [data-product-id="hot-wings"]');
  await wings.getByRole('button', { name: 'إضافة جنحان حار للسلة', exact: true }).click();
  await expect(page.locator('.cart-summary-total strong')).toHaveText('98 ₪');
  await expect(page.locator('.header-cart')).toHaveAttribute('aria-label', 'السلة، 3 قطع');
  await page.reload();
  await expect(card.getByLabel('عدد بروست ٤ قطع', { exact: true })).toHaveText('2');
  await expect(page.locator('.cart-summary-total strong')).toHaveText('98 ₪');
  await page.locator('.cart-summary-action').click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-total')).toHaveText('98 ₪');
  await page.getByRole('button', { name: 'تقليل كمية بروست ٤ قطع', exact: true }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('63 ₪');
  await page.getByRole('button', { name: 'إزالة جنحان حار من السلة', exact: true }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('35 ₪');
  await page.reload();
  await expect(page.getByTestId('cart-total')).toHaveText('35 ₪');
  await page.getByRole('button', { name: 'تقليل كمية بروست ٤ قطع', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'سلتك فارغة حاليًا' })).toBeVisible();
  await page.getByRole('link', { name: 'تصفح المنيو', exact: true }).click();
  await page.locator('.category-strip').getByRole('link', { name: 'مشروبات', exact: true }).click();
  await expect(page).toHaveURL(/#category-drinks$/);
  await expect(page.getByRole('heading', { name: 'مشروبات', exact: true })).toBeInViewport();
  await expect(page.locator('.category-card.is-selected')).toHaveText('مشروبات');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'فتح قائمة الأقسام' }).click();
  await expect(page.getByRole('navigation', { name: 'أقسام القائمة' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'أقسام القائمة' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('only valid active offers replace featured meals and use the discounted cart price', async ({ page }) => {
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  const product = await models.Product.findOne({ slug: 'family-meal' });
  const active = { slug: 'valid', productId: product._id, title: 'عرض لمّة العائلة', description: 'وجبة العائلة بسعر خاص', image: '/images/family-meal.webp', originalPrice: 85, offerPrice: 75, isActive: true, startDate: new Date(now - 60000).toISOString(), endDate: new Date(now + 60000).toISOString() };
  const data = [active,
    { ...active, slug: 'disabled', isActive: false },
    { ...active, slug: 'expired', endDate: new Date(now - 1000).toISOString() },
    { ...active, slug: 'future', startDate: new Date(now + 30000).toISOString() },
  ];
  await models.Offer.create(data);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'عرض اليوم' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'وجباتنا المميّزة' })).toHaveCount(0);
  await expect(page.locator('.offers-section .product-card')).toHaveCount(1);
  await expect(page.locator('.offers-section del')).toHaveText('85 ₪');
  await page.locator('.offers-section .add-button').click();
  await expect(page.locator('.cart-summary-total strong')).toHaveText('75 ₪');
  await page.locator('.cart-summary-action').click();
  await expect(page.getByTestId('cart-total')).toHaveText('75 ₪');
  await page.clock.fastForward(60001);
  await expect(page.getByTestId('cart-total')).toHaveText('85 ₪');
  await page.getByRole('link', { name: 'العودة لقائمة الطعام', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'وجباتنا المميّزة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'عرض اليوم' })).toHaveCount(0);
});

test('unavailable localStorage does not prevent the menu or cart from working', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } }));
  await page.goto('/');
  await page.locator('.featured-section .add-button').first().click();
  await expect(page.locator('.cart-summary-total strong')).toHaveText('60 ₪');
});

for (const [label, width, height] of [['small', 320, 720], ['iphone', 390, 844], ['android', 430, 932], ['tablet', 768, 1024], ['ipad-11', 820, 1180], ['desktop', 1440, 1000]]) {
  test(`responsive layout, loaded assets and controls: ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('.product-card').first()).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images];
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map((image) => image.decode()));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const unloaded = await page.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src));
    expect(unloaded).toEqual([]);
    const overlaps = await page.locator('.product-actions').evaluateAll((rows) => rows.filter((row) => {
      const add = row.querySelector('.add-button').getBoundingClientRect();
      const quantity = row.querySelector('.quantity-selector').getBoundingClientRect();
      const horizontal = Math.min(add.right, quantity.right) - Math.max(add.left, quantity.left);
      const vertical = Math.min(add.bottom, quantity.bottom) - Math.max(add.top, quantity.top);
      return horizontal > 1 && vertical > 1;
    }).length);
    expect(overlaps).toBe(0);
    await page.screenshot({ path: `test-results/${label}-menu.png`, fullPage: true });
    await page.locator('.featured-section .add-button').first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.locator('.cart-summary-action')).toBeInViewport();
    await page.screenshot({ path: `test-results/${label}-cart-bar.png` });
    await page.locator('.cart-summary-action').click();
    await expect(page.getByTestId('cart-total')).toHaveText('60 ₪');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/${label}-cart.png`, fullPage: true });
  });
}
