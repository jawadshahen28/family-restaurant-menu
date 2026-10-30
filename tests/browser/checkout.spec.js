import { test, expect, models } from './fixtures.js';
import { CART_STORAGE_KEY } from '../../src/utils/cart.js';

const seededCart = [{ productId: 'broast-4', quantity: 2 }, { productId: 'hot-wings', quantity: 1 }];
const deliveryNotice = 'السعر لا يشمل رسوم التوصيل، ويتم تحديدها بالتواصل مع المطعم.';
const confirmButton = (page) => page.getByRole('button', { name: 'تأكيد الطلب', exact: true });
async function seedCart(page) {
  await page.addInitScript(({ key, cart }) => {
    if (!sessionStorage.getItem('checkout-test-seeded')) { localStorage.setItem(key, JSON.stringify(cart)); sessionStorage.setItem('checkout-test-seeded', 'true'); }
  }, { key: CART_STORAGE_KEY, cart: seededCart });
}
async function fillCustomer(page) {
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد أبو عيشة');
  await page.getByRole('textbox', { name: 'رقم الهاتف', exact: true }).fill('٠٥٩٩١٢٣٤٥٦');
}
async function readSaved(page) {
  return { cart: await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), CART_STORAGE_KEY), orders: await models.Order.find().lean() };
}
const successURL = /\/order-success\/[a-f\d]{24}#token=[A-Za-z0-9_-]{43}$/;

test('complete pickup navigation, persistence, real confirmation and safe confirmation reload', async ({ page }) => {
  const errors = [];
  const posts = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await seedCart(page);
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'سلة المشتريات', exact: true })).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('98 ₪');
  await page.getByRole('link', { name: 'المتابعة لإتمام الطلب', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator('.checkout-page .order-notice')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.getByRole('radio', { name: /استلام من المطعم/ })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'عنوان التوصيل', exact: true })).toHaveCount(0);
  await expect(page.getByText(deliveryNotice)).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
  await page.getByRole('link', { name: 'العودة إلى السلة', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('cart-total')).toHaveText('98 ₪');
  await page.getByRole('link', { name: 'المتابعة لإتمام الطلب', exact: true }).click();
  await fillCustomer(page);
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  await expect(page.getByRole('heading', { name: 'تم تأكيد طلبك بنجاح!', exact: true })).toBeVisible();
  await expect(page.getByText('جديد', { exact: true })).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
  await expect(page.getByText('أحمد أبو عيشة', { exact: true })).toBeVisible();
  const saved = await readSaved(page);
  expect(saved.cart).toEqual([]);
  expect(saved.orders).toHaveLength(1);
  expect(saved.orders[0]).toMatchObject({ status: 'new', productsSubtotal: 98, fulfillmentType: 'pickup', deliveryAddress: null });
  expect(saved.orders[0].items[0]).toMatchObject({ quantity: 2, unitPrice: 35, lineTotal: 70 });
  expect(await page.evaluate(() => localStorage.getItem('family-restaurant-orders-v1'))).toBeNull();
  const successUrl = page.url();
  await page.reload();
  await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
  await page.getByRole('link', { name: 'العودة إلى المنيو', exact: true }).last().click();
  await expect(page.locator('.cart-summary')).toHaveCount(0);
  await page.locator('.featured-section .add-button').first().click();
  await page.goto(successUrl);
  await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
  expect((await readSaved(page)).cart).toEqual([{ productId: 'broast-8', quantity: 1 }]);
  expect(posts).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('required fields, phone errors, focus and values survive validation failures', async ({ page }) => {
  await seedCart(page); await page.goto('/checkout');
  await confirmButton(page).click();
  const name = page.getByRole('textbox', { name: 'الاسم', exact: true });
  const phone = page.getByRole('textbox', { name: 'رقم الهاتف', exact: true });
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await name.fill('أحمد أبو عيشة'); await phone.fill('123');
  await page.getByRole('textbox', { name: 'ملاحظات إضافية (اختياري)', exact: true }).fill('بدون مخلل');
  await page.getByRole('radio', { name: /توصيل/ }).check();
  await confirmButton(page).click();
  await expect(phone).toBeFocused();
  await expect(page.locator('#error-phone')).toContainText('رقم هاتف صحيح');
  await expect(page.locator('#error-deliveryAddress')).toContainText('عنوان التوصيل');
  await expect(name).toHaveValue('أحمد أبو عيشة');
  await expect(page.getByRole('textbox', { name: 'ملاحظات إضافية (اختياري)', exact: true })).toHaveValue('بدون مخلل');
  expect((await readSaved(page)).orders).toHaveLength(0);
  await phone.fill('+972 599 123 456');
  await page.getByRole('radio', { name: /استلام من المطعم/ }).check();
  await expect(page.getByRole('textbox', { name: 'عنوان التوصيل', exact: true })).toHaveCount(0);
  await expect(page.getByText(deliveryNotice)).toHaveCount(0);
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  expect((await readSaved(page)).orders[0]).toMatchObject({ notes: 'بدون مخلل', deliveryAddress: null, fulfillmentType: 'pickup' });
});

test('delivery requires an address and confirmation retains fee notice and products-only totals', async ({ page }) => {
  await seedCart(page); await page.goto('/checkout'); await fillCustomer(page);
  await page.getByRole('radio', { name: /توصيل/ }).check();
  await expect(page.getByText(deliveryNotice, { exact: true })).toBeVisible();
  await expect(page.getByText('الإجمالي بدون التوصيل', { exact: true })).toBeVisible();
  await confirmButton(page).click();
  const address = page.getByRole('textbox', { name: 'عنوان التوصيل', exact: true });
  await expect(address).toBeFocused();
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await address.fill('نابلس، شارع الجامعة، بجانب المكتبة');
  await page.getByRole('textbox', { name: 'ملاحظات إضافية (اختياري)', exact: true }).fill('الصوص على جنب');
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  await expect(page.getByText('نابلس، شارع الجامعة، بجانب المكتبة', { exact: true })).toBeVisible();
  await expect(page.getByText('الصوص على جنب', { exact: true })).toBeVisible();
  await expect(page.getByText(deliveryNotice, { exact: true })).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
  const { orders, cart } = await readSaved(page);
  expect(cart).toEqual([]); expect(orders[0]).not.toHaveProperty('deliveryFee');
});

test('empty cart cannot submit through direct checkout navigation', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'سلتك فارغة حاليًا', exact: true })).toBeVisible();
  await expect(confirmButton(page)).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'تصفح المنيو', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect((await readSaved(page)).orders).toHaveLength(0);
});

test('processing disables controls and rapid duplicate submits create one database order', async ({ page }) => {
  await seedCart(page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/orders', async (route) => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.goto('/checkout'); await fillCustomer(page); await confirmButton(page).click();
  await expect(page.getByRole('button', { name: 'جارٍ إرسال طلبك…', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'الاسم', exact: true })).toBeDisabled();
  await page.locator('form').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
  release();
  await expect(page).toHaveURL(successURL);
  expect((await readSaved(page)).orders).toHaveLength(1);
});

test('backend failure preserves cart and customer fields; retry uses real storage only', async ({ page }) => {
  await seedCart(page);
  await page.route('**/api/orders', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'تعذر إرسال الطلب حاليًا، يرجى المحاولة مرة أخرى.' } }) }));
  await page.goto('/checkout'); await fillCustomer(page); await confirmButton(page).click();
  await expect(page.getByRole('alert')).toContainText('تعذر إرسال الطلب');
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('textbox', { name: 'الاسم', exact: true })).toHaveValue('أحمد أبو عيشة');
  await expect(confirmButton(page)).toBeEnabled();
  const failed = await readSaved(page);
  expect(failed.cart).toEqual(seededCart); expect(failed.orders).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('family-restaurant-orders-v1'))).toBeNull();
  await page.unroute('**/api/orders');
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  expect((await readSaved(page)).cart).toEqual([]);
  expect(await models.Order.countDocuments()).toBe(1);
});

test('unavailable saved products remain removable and block checkout', async ({ page }) => {
  await seedCart(page);
  await models.Product.updateOne({ slug: 'broast-4' }, { isAvailable: false });
  await page.goto('/checkout');
  await expect(page.getByRole('alert')).toContainText('غير متوفر');
  await expect(confirmButton(page)).toBeDisabled();
  expect((await readSaved(page)).cart).toEqual(seededCart);
  await page.getByRole('link', { name: 'العودة إلى السلة', exact: true }).click();
  await expect(page.getByText('غير متوفر حاليًا', { exact: true })).toBeVisible();
  await page.locator('[data-cart-product-id="broast-4"]').getByRole('button', { name: /إزالة/ }).click();
  await expect(page.getByRole('link', { name: 'المتابعة لإتمام الطلب', exact: true })).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('28 ₪');
});

test('a lost acknowledgement safely retries the original persisted order without duplication', async ({ page }) => {
  await seedCart(page);
  const identities = [];
  await page.route('**/api/orders', async (route) => { identities.push(route.request().postDataJSON().submissionId); await route.fetch(); await route.abort('connectionfailed'); });
  await page.goto('/checkout'); await fillCustomer(page); await confirmButton(page).click();
  await expect(page.getByRole('alert')).toContainText('تعذر إرسال الطلب');
  expect(await models.Order.countDocuments()).toBe(1);
  expect((await readSaved(page)).cart).toEqual(seededCart);
  await page.unroute('**/api/orders');
  page.on('request', (request) => { if (request.method() === 'POST') identities.push(request.postDataJSON().submissionId); });
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  expect(identities[0]).toBe(identities[1]);
  expect(await models.Order.countDocuments()).toBe(1);
});

test('navigating back keeps the cart and never treats an aborted response as success', async ({ page }) => {
  await seedCart(page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/orders', async (route) => { await gate; await route.abort('connectionfailed').catch(() => {}); });
  await page.goto('/checkout'); await fillCustomer(page); await confirmButton(page).click();
  await page.getByRole('link', { name: 'العودة إلى السلة', exact: true }).click(); release();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-total')).toHaveText('98 ₪');
  expect(await models.Order.countDocuments()).toBe(0);
});

for (const path of ['/order-success', '/order-success/invalid', '/order-success/507f1f77bcf86cd799439011']) {
  test(`missing order is handled safely: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'الطلب غير موجود', exact: true })).toBeVisible();
    await expect(page.locator('.confirmation-details')).toHaveCount(0);
  });
}

test('closed restaurant is browsable and checkout explains why new orders are disabled', async ({ page }) => {
  await seedCart(page);
  await models.StoreSettings.updateOne({ _id: 'store' }, { isOpen: false });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'وجباتنا المميّزة' })).toBeVisible();
  await expect(page.getByText('المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.', { exact: true })).toBeVisible();
  await page.goto('/checkout');
  await expect(confirmButton(page)).toBeDisabled();
  expect(await models.Order.countDocuments()).toBe(0);
});

test('disabled delivery remains visible but cannot be selected', async ({ page }) => {
  await seedCart(page);
  await models.StoreSettings.updateOne({ _id: 'store' }, { deliveryEnabled: false });
  await page.goto('/checkout');
  await expect(page.getByRole('radio', { name: /توصيل/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /استلام من المطعم/ })).toBeEnabled();
});

test('server price changes refresh the cart and require explicit review and resubmission', async ({ page }) => {
  await seedCart(page); await page.goto('/checkout'); await fillCustomer(page);
  await models.Product.updateOne({ slug: 'broast-4' }, { price: 44 });
  await confirmButton(page).click();
  await expect(page.getByRole('alert')).toContainText('تغيّرت أسعار');
  await expect(page.getByTestId('order-total')).toHaveText('116 ₪');
  await expect(page.getByRole('textbox', { name: 'الاسم', exact: true })).toHaveValue('أحمد أبو عيشة');
  expect(await models.Order.countDocuments()).toBe(0);
  expect((await readSaved(page)).cart).toEqual(seededCart);
  await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  await expect(page.getByTestId('order-total')).toHaveText('116 ₪');
});

test('menu connection failures display an error and never fall back to mock arrays', async ({ page }) => {
  await page.route('**/api/products', (route) => route.abort('connectionfailed'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('تعذّر تحميل البيانات');
  await expect(page.locator('.product-card')).toHaveCount(0);
  await page.unroute('**/api/products');
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('confirmation token stays out of API URLs and invalid access reveals no customer data', async ({ page }) => {
  await seedCart(page); await page.goto('/checkout'); await fillCustomer(page); await confirmButton(page).click();
  await expect(page).toHaveURL(successURL);
  await expect(page.getByTestId('order-reference')).toBeVisible();
  const validUrl = page.url();
  const requests = [];
  page.on('request', (request) => { if (request.url().includes('/api/orders/')) requests.push(request); });
  await page.reload();
  await expect(page.getByTestId('order-reference')).toBeVisible();
  expect(requests.every((request) => !request.url().includes('token') && !!request.headers().authorization)).toBeTruthy();
  await page.goto(validUrl.replace(/#token=.*/, '#token=' + 'A'.repeat(43)));
  await expect(page.getByRole('heading', { name: 'الطلب غير موجود', exact: true })).toBeVisible();
  await expect(page.getByText('أحمد أبو عيشة', { exact: true })).toHaveCount(0);
});

test('normal customer pages contain no development disclaimers and keep the delivery notice', async ({ page }) => {
  const disallowed = /قائمة تجريبية|الأسعار للتوضيح فقط|أسعار تجريبية|غير معتمدة من المطعم|طلب تجريبي|لم يتم إرساله إلى المطعم|Demo Menu|Demo Order|Sample Prices|Unverified Prices/i;
  const cleanPage = async () => {
    expect(await page.locator('body').innerText()).not.toMatch(disallowed);
    await expect(page.locator('.demo-notice, .order-sample-prices, .demo-order-notice')).toHaveCount(0);
  };
  await seedCart(page);
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await cleanPage();
  await page.goto('/cart');
  await expect(page.getByTestId('cart-total')).toHaveText('98 ₪');
  await cleanPage();
  await page.getByRole('link', { name: 'المتابعة لإتمام الطلب', exact: true }).click();
  await expect(confirmButton(page)).toBeEnabled();
  await page.getByRole('radio', { name: /توصيل/ }).check();
  await fillCustomer(page);
  await page.getByRole('textbox', { name: 'عنوان التوصيل', exact: true }).fill('نابلس، شارع الجامعة، بجانب المكتبة');
  await expect(page.getByText(deliveryNotice, { exact: true })).toBeVisible();
  await cleanPage();
  await confirmButton(page).click();
  await expect(page.getByRole('heading', { name: 'تم تأكيد طلبك بنجاح!', exact: true })).toBeVisible();
  await expect(page.getByText(deliveryNotice, { exact: true })).toBeVisible();
  await cleanPage();
  expect((await readSaved(page)).cart).toEqual([]);
});

for (const [label, width, height] of [['small', 320, 720], ['iphone', 390, 844], ['ipad-11', 820, 1180], ['desktop', 1440, 1000]]) {
  test(`checkout and confirmation fit the screen: ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedCart(page); await page.goto('/checkout');
    await page.getByRole('radio', { name: /توصيل/ }).check(); await fillCustomer(page);
    await page.getByRole('textbox', { name: 'عنوان التوصيل', exact: true }).fill('نابلس، شارع الجامعة، بجانب المكتبة');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.locator('.cart-summary')).toHaveCount(0);
    expect(await page.locator('#customer-name').evaluate((input) => input.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    if (width <= 700) {
      const summary = await page.locator('.order-summary').boundingBox(); const submit = await confirmButton(page).boundingBox();
      expect(summary.y + summary.height).toBeLessThan(submit.y);
    }
    await page.screenshot({ path: `test-results/checkout-${label}.png`, fullPage: true });
    await confirmButton(page).click(); await expect(page).toHaveURL(successURL);
    await expect(page.getByTestId('order-total')).toHaveText('98 ₪');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/confirmation-${label}.png`, fullPage: true });
  });
}
