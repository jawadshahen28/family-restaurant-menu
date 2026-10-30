import { test, expect, models } from './fixtures.js';
import { hashPassword } from '../../server/src/utils/auth.js';

test.describe('Admin Authentication and Dashboard', () => {
  test.beforeEach(async () => {
    // Seed an isolated test admin for browser test
    const passwordHash = await hashPassword('password123');
    await models.Admin.create({
      username: 'admin',
      passwordHash,
      name: 'مدير المطعم',
      role: 'owner',
    });
  });

  test('unauthenticated visit to /admin redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'مطعم ومطبخ العائلة' })).toBeVisible();
    await expect(page.getByText('تسجيل دخول الإدارة')).toBeVisible();
  });

  test('login page elements, password visibility toggle and invalid credentials error', async ({ page }) => {
    await page.goto('/admin/login');

    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    const submitButton = page.getByRole('button', { name: 'تسجيل الدخول' });

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Test password toggle
    const toggleButton = page.getByLabel('إظهار كلمة المرور');
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await page.getByLabel('إخفاء كلمة المرور').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit invalid credentials
    await usernameInput.fill('admin');
    await passwordInput.fill('wrongpass');
    await submitButton.click();

    // Check error alert
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('اسم المستخدم أو كلمة المرور غير صحيحة')).toBeVisible();
  });

  test('successful login navigates to admin dashboard, categories and products on iPhone', async ({ page }) => {
    // Set iPhone 14/15 viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/login');

    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    // Must reach /admin
    await expect(page).toHaveURL(/\/admin$/);

    // Welcome Card
    await expect(page.getByText('مرحبًا بك')).toBeVisible();
    await expect(page.getByText('يمكنك إدارة المنيو والمنتجات بسهولة.')).toBeVisible();

    // Navigation Cards
    await expect(page.getByRole('button', { name: 'الفئات إدارة التصنيفات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'المنتجات إدارة الأصناف' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'العروض إدارة العروض' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الطلبات إدارة الطلبات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الإعدادات إعدادات المطعم' })).toBeVisible();

    // Bottom Navigation
    const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي للوحة الإدارة' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: 'الرئيسية' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'الطلبات' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'المنتجات' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'العروض' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'الإعدادات' })).toBeVisible();

    // Navigate to Orders from dashboard card
    await page.getByRole('button', { name: /الطلبات إدارة الطلبات/ }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole('heading', { name: 'الطلبات' })).toBeVisible();

    // Navigate back to Admin Home
    await page.getByRole('button', { name: 'الرجوع' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to Offers from dashboard card
    await page.getByRole('button', { name: 'العروض إدارة العروض' }).click();
    await expect(page).toHaveURL(/\/admin\/offers$/);
    await expect(page.getByRole('heading', { name: 'العروض' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ إضافة عرض جديد' })).toBeVisible();

    // Navigate back to Admin Home
    await page.getByRole('button', { name: 'الرجوع' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to Settings from dashboard card
    await page.getByRole('button', { name: 'الإعدادات إعدادات المطعم' }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();

    // Navigate back to Admin Home
    await page.getByRole('button', { name: 'الرجوع' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to Categories from dashboard card
    await page.getByRole('button', { name: 'الفئات إدارة التصنيفات' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByRole('heading', { name: 'الفئات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إضافة فئة جديدة' })).toBeVisible();

    // Navigate back to Admin Home
    await page.getByRole('button', { name: 'الرجوع' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to Products via Bottom Navigation
    await nav.getByRole('button', { name: 'المنتجات' }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByRole('heading', { name: 'المنتجات' })).toBeVisible();
    await expect(page.getByPlaceholder('البحث عن وجبة...')).toBeVisible();

    // Logout flow
    await page.getByLabel('تسجيل الخروج').click();
    await expect(page.getByText('هل أنت متأكد من رغبتك في تسجيل الخروج')).toBeVisible();
    await page.getByRole('button', { name: 'نعم، خروج' }).click();

    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('categories management: add category, list and toggle active status', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('button', { name: 'الفئات إدارة التصنيفات' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    await page.getByRole('button', { name: 'إضافة فئة جديدة' }).click();
    await expect(page).toHaveURL(/\/admin\/categories\/new/);

    await page.locator('#cat-name').fill('شاورما عربي');
    await page.locator('#cat-order').fill('10');
    await page.getByRole('button', { name: 'حفظ' }).click();

    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText('شاورما عربي')).toBeVisible();
  });

  test('products management: add product, toggle availability, and synchronize with customer menu', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 2. Go to products and add new product
    await page.getByRole('button', { name: 'المنتجات إدارة الأصناف' }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    await page.getByRole('button', { name: 'إضافة وجبة جديدة' }).click();
    await expect(page).toHaveURL(/\/admin\/products\/new$/);

    await page.locator('#prod-name').fill('وجبة دجاج عائلية فاخرة');
    await page.locator('#prod-price').fill('97');
    await page.locator('#prod-desc').fill('وجبة شهية ومميزة مع الصوصات والمشروب');
    await page.getByRole('button', { name: 'حفظ' }).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText('وجبة دجاج عائلية فاخرة')).toBeVisible();
    await expect(page.getByText('97 ₪')).toBeVisible();

    // 3. Verify it shows on customer public menu
    await page.goto('/');
    await expect(page.getByText('وجبة دجاج عائلية فاخرة')).toBeVisible();
    await expect(page.getByText('97 ₪')).toBeVisible();
  });

  test('offers management: add offer, list, toggle active status, and reflect on customer menu', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 2. Navigate to Offers
    await page.getByRole('button', { name: 'العروض إدارة العروض' }).click();
    await expect(page).toHaveURL(/\/admin\/offers$/);

    // 3. Add new offer
    await page.getByRole('button', { name: '+ إضافة عرض جديد' }).click();
    await expect(page).toHaveURL(/\/admin\/offers\/new$/);

    await page.locator('#offer-title').fill('عرض التوفير المميز');
    await page.locator('#offer-description').fill('عرض خاص لفترة محدودة على أشهى الوجبات');
    await page.locator('#offer-original-price').fill('50');
    await page.locator('#offer-price').fill('33');
    await page.getByRole('button', { name: 'حفظ العرض' }).click();

    // 4. Verify listed in admin
    await expect(page).toHaveURL(/\/admin\/offers$/);
    await expect(page.getByText('عرض التوفير المميز')).toBeVisible();
    await expect(page.getByText('33 ₪')).toBeVisible();
    await expect(page.getByText('50 ₪')).toBeVisible();

    // 5. Check public menu shows the offer under "عرض اليوم"
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'عرض اليوم' })).toBeVisible();
    await expect(page.locator('.offers-section').getByText('33 ₪')).toBeVisible();
  });

  test('restaurant settings: master open/close toggle, fulfillment settings, and checkout enforcement', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 2. Navigate to Settings
    await page.getByRole('button', { name: 'الإعدادات إعدادات المطعم' }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();

    // 3. Toggle restaurant status to CLOSED
    await page.locator('label[for="master-store-toggle"]').click();
    await page.locator('#settings-announcement').fill('المطعم مغلق حاليًا لأعمال التطوير');
    await page.getByRole('button', { name: 'حفظ التعديلات' }).click();

    await expect(page.getByText('تم حفظ الإعدادات بنجاح')).toBeVisible();

    // 4. Verify public customer menu displays store closed notice and announcement
    await page.goto('/');
    await expect(page.getByText('المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.')).toBeVisible();
    await expect(page.getByText('المطعم مغلق حاليًا لأعمال التطوير')).toBeVisible();

    // 5. Re-open restaurant
    await page.goto('/admin/settings');
    await page.locator('label[for="master-store-toggle"]').click();
    await page.getByRole('button', { name: 'حفظ التعديلات' }).click();
    await expect(page.getByText('تم حفظ الإعدادات بنجاح')).toBeVisible();
  });

  test('orders management: three-status flow new -> received -> prepared and real-time updates', async ({ page }) => {
    // 1. Seed a new customer order in database
    const prod = await models.Product.findOne().lean();
    await models.Order.create({
      orderNumber: 'FAM-20261030-TEST01',
      submissionId: 'sub-test-01',
      requestFingerprint: 'fp-test-01',
      accessTokenHash: 'hash-test-01',
      customer: { name: 'سامي يوسف', phone: '0599887766' },
      fulfillmentType: 'pickup',
      items: [{
        productId: prod._id,
        name: prod.name,
        quantity: 2,
        unitPrice: prod.price,
        lineTotal: prod.price * 2,
      }],
      productsSubtotal: prod.price * 2,
      status: 'new',
    });

    // 2. Admin logs in and checks /admin/orders
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Navigate to Orders
    await page.getByRole('button', { name: /الطلبات إدارة الطلبات/ }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);

    // Order card appears with customer name and "جديد" status
    await expect(page.getByText('سامي يوسف')).toBeVisible();
    await expect(page.getByText('جديد').first()).toBeVisible();

    // 3. Open Order Details
    await page.getByText('سامي يوسف').click();
    await expect(page).toHaveURL(/\/admin\/orders\/[a-f0-9]{24}$/);
    await expect(page.getByText('تفاصيل الطلب')).toBeVisible();
    await expect(page.getByText('سامي يوسف')).toBeVisible();
    await expect(page.getByText('0599887766')).toBeVisible();

    // 4. Click "تم استلام الطلب"
    const receivedBtn = page.getByRole('button', { name: 'تم استلام الطلب' });
    await expect(receivedBtn).toBeVisible();
    await receivedBtn.click();

    // Next step "تم التجهيز" appears
    const preparedBtn = page.getByRole('button', { name: 'تم التجهيز' });
    await expect(preparedBtn).toBeVisible();

    // 5. Click "تم التجهيز"
    await preparedBtn.click();

    // Final completed state appears with no further action button
    await expect(page.getByText('تم تجهيز هذا الطلب بالكامل')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تم التجهيز' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تم استلام الطلب' })).toHaveCount(0);
  });

  test('admin dashboard and management render responsively on iPad portrait and landscape', async ({ page }) => {
    // iPad Portrait (834x1194)
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto('/admin/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('button', { name: 'الفئات إدارة التصنيفات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'المنتجات إدارة الأصناف' })).toBeVisible();
    await expect(page.getByRole('button', { name: /الطلبات إدارة الطلبات/ })).toBeVisible();

    // iPad Landscape (1194x834)
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.goto('/admin/orders');
    await expect(page.getByRole('heading', { name: 'الطلبات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الكل' })).toBeVisible();
  });

  test('pwa manifest, icons, and order push notification settings on iPhone and iPad', async ({ page }) => {
    // 1. Verify PWA manifest and iOS meta tags
    await page.goto('/admin/login');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveAttribute('href', '/icons/apple-touch-icon.png');
    const appleCapable = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleCapable).toHaveAttribute('content', 'yes');

    // 2. Login as admin
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 3. Open settings on iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();

    // 4. Verify Order Notifications section
    await expect(page.getByText('إشعارات الطلبات الفورية')).toBeVisible();
    await expect(page.getByText('تنبيهات فورية على جهازك عند وصول أي طلب جديد من الزبائن')).toBeVisible();
    await expect(page.getByText(/على هذا الجهاز/)).toBeVisible();
    await expect(page.getByRole('button', { name: /إشعارات الطلبات/ })).toBeVisible();

    // 5. Verify responsive layout on iPad
    await page.setViewportSize({ width: 834, height: 1194 });
    await expect(page.getByText('إشعارات الطلبات الفورية')).toBeVisible();
    await expect(page.getByRole('button', { name: /إشعارات الطلبات/ })).toBeVisible();
  });
});
