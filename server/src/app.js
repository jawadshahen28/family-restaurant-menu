import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError, errorHandler } from './utils/errors.js';
import { logger as defaultLogger } from './utils/logger.js';
import { objectId, validateOrder } from './validators/orders.js';
import { validateAdminLogin } from './validators/admin.js';
import { validateCreateCategory, validateUpdateCategory } from './validators/adminCategory.js';
import { validateCreateProduct, validateUpdateProduct } from './validators/adminProduct.js';
import { validateCreateOffer, validateUpdateOffer } from './validators/adminOffer.js';
import { validateUpdateSettings } from './validators/adminSettings.js';
import { validateUpdateOrderStatus } from './validators/adminOrder.js';
import { subscribeSchema, unsubscribeSchema } from './validators/adminPush.js';
import { categoryDto, productDto, offerDto, publicStore } from './services/menuService.js';
import { createOrderService } from './services/orderService.js';
import { createAdminAuthService } from './services/adminAuthService.js';
import { createUploadService } from './services/uploadService.js';
import { createPushService } from './services/pushService.js';
import { generateSlug, makeUniqueSlug } from './utils/slug.js';
import { parseCookies, setSessionCookie, clearSessionCookie, ADMIN_SESSION_COOKIE } from './utils/cookies.js';
import { safeOriginForLog } from './config/origins.js';
import { serveFrontend } from './frontend.js';

export function createApp({ repository, config, logger = defaultLogger, limiter = {}, uploadsDir, frontendDir, pushService: injectedPushService } = {}) {
  const app = express();
  const pushService = injectedPushService || createPushService({ repository, vapid: config?.vapid });
  const orders = createOrderService(repository, { pushService });
  const adminAuth = createAdminAuthService(repository);
  const uploadService = createUploadService({ uploadsDir });
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy || false);

  // Serve static uploaded files
  app.use('/uploads', express.static(uploadsDir || path.resolve('public/uploads')));

  app.use((req, res, next) => {
    req.requestId = randomUUID(); req.log = logger;
    res.setHeader('X-Request-Id', req.requestId);
    const started = Date.now();
    res.on('finish', () => logger.info('http_request', { requestId: req.requestId, method: req.method, path: req.route?.path || 'unmatched', status: res.statusCode, durationMs: Date.now() - started }));
    next();
  });
  app.use(helmet(config.serveFrontend ? {
    contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'blob:', 'https:'] } },
  } : {}));
  app.use(cors({ origin(origin, callback) {
    if (origin && !config.allowedOrigins.includes(origin)) {
      if (config.nodeEnv === 'development') logger.info('origin_rejected', { origin: safeOriginForLog(origin) });
      return callback(new ApiError(403, 'ORIGIN_DENIED', 'مصدر الطلب غير مسموح.'));
    }
    callback(null, true);
  }, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], credentials: true, maxAge: 600 }));

  // High-limit parser specifically for authenticated admin file uploads
  app.use('/api/admin/upload', express.json({ limit: '10mb' }));
  // Default strict 24kb limit for all other API routes
  app.use(express.json({ limit: '24kb', strict: true }));

  const success = (res, data, status = 200) => res.status(status).json({ success: true, data, meta: { serverTime: new Date().toISOString() } });
  const limited = (limit) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, handler(req, res) { res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.' }, requestId: req.requestId }); } });

  // Reusable admin session and CSRF verification middleware
  const requireAdmin = async (req, res, next) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies[ADMIN_SESSION_COOKIE];
      const { user, csrfToken } = await adminAuth.verifySession(sessionId);
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        adminAuth.verifyCsrf(csrfToken, req.headers['x-csrf-token']);
      }
      req.admin = user;
      req.csrfToken = csrfToken;
      next();
    } catch (err) {
      next(err);
    }
  };

  app.get('/api/health', async (req, res) => { if (!(await repository.healthy())) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'الخدمة غير متاحة مؤقتًا.'); success(res, { status: 'ok' }); });
  app.get('/api/categories', async (req, res) => success(res, (await repository.categories()).map(categoryDto)));
  app.get('/api/products', async (req, res) => {
    const category = req.query.category;
    if (category !== undefined && (typeof category !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(category))) throw new ApiError(400, 'INVALID_CATEGORY', 'معرّف التصنيف غير صحيح.');
    success(res, (await repository.products(category)).map(productDto));
  });
  app.get('/api/products/:id', async (req, res) => {
    if (!objectId.safeParse(req.params.id).success) throw new ApiError(400, 'INVALID_ID', 'معرّف المنتج غير صحيح.');
    const [product] = await repository.productsByIds([req.params.id]);
    if (!product || !product.isAvailable || !product.categoryId?.isActive) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'المنتج غير متوفر حاليًا.');
    success(res, productDto(product));
  });
  app.get('/api/offers', async (req, res) => {
    const offers = await repository.currentOffers(Date.now());
    const products = await repository.productsByIds([...new Set(offers.map((offer) => String(offer.productId)))]);
    const visible = offers.flatMap((offer) => {
      const product = products.find((entry) => String(entry._id) === String(offer.productId) && entry.isAvailable && entry.categoryId?.isActive);
      return product ? [offerDto(offer, product)] : [];
    });
    success(res, visible);
  });
  app.get('/api/store', async (req, res) => success(res, publicStore(await repository.store())));
  app.post('/api/orders', limited(limiter.orders ?? 10), async (req, res) => {
    const result = await orders.submit(validateOrder(req.body));
    res.setHeader('Cache-Control', 'no-store');
    success(res, result, result.replayed ? 200 : 201);
  });
  app.get('/api/orders/:id', limited(limiter.confirmations ?? 60), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('authorization') || '')?.[1];
    if (!objectId.safeParse(req.params.id).success || !token) throw new ApiError(404, 'ORDER_NOT_FOUND', 'الطلب غير موجود أو رابط الوصول غير صحيح.');
    success(res, await orders.retrieve(req.params.id, token));
  });

  // Admin Authentication Endpoints
  app.post('/api/admin/login', limited(limiter.adminLogin ?? 10), async (req, res) => {
    const credentials = validateAdminLogin(req.body);
    const result = await adminAuth.login({
      username: credentials.username,
      password: credentials.password,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    res.setHeader('Cache-Control', 'no-store');
    setSessionCookie(res, result.sessionId, { secure: config.nodeEnv === 'production' });
    success(res, { user: result.user, csrfToken: result.csrfToken });
  });

  app.get('/api/admin/me', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    success(res, { authenticated: true, user: req.admin, csrfToken: req.csrfToken });
  });

  app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[ADMIN_SESSION_COOKIE];
    await adminAuth.logout(sessionId);
    clearSessionCookie(res, { secure: config.nodeEnv === 'production' });
    success(res, { loggedOut: true });
  });

  // Admin Image Upload Endpoint
  app.post('/api/admin/upload', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = await uploadService.uploadImage(req.body || {});
    success(res, result, 201);
  });

  // Admin Category Endpoints
  app.get('/api/admin/categories', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const categories = await repository.allCategoriesWithCounts();
    success(res, categories);
  });

  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = validateCreateCategory(req.body);
    const baseSlug = generateSlug(data.name, 'category');
    const slug = await makeUniqueSlug(repository.models.Category, baseSlug);
    const created = await repository.createCategory({ ...data, slug });
    success(res, { ...created, id: String(created._id), productCount: 0 }, 201);
  });

  app.patch('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الفئة غير صالح.');
    }
    const data = validateUpdateCategory(req.body);
    const existing = await repository.findCategoryById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'الفئة غير موجودة.');
    }
    const updated = await repository.updateCategory(req.params.id, data);
    const count = await repository.countProductsForCategory(req.params.id);
    success(res, { ...updated, id: String(updated._id), productCount: count });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الفئة غير صالح.');
    }
    const existing = await repository.findCategoryById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'الفئة غير موجودة.');
    }
    const count = await repository.countProductsForCategory(req.params.id);
    if (count > 0) {
      throw new ApiError(409, 'CATEGORY_IN_USE', `لا يمكن حذف الفئة لاحتوائها على ${count} من الوجبات. يرجى نقل الوجبات أو حذفها أولاً.`);
    }
    await repository.deleteCategory(req.params.id);
    success(res, { deleted: true, id: req.params.id });
  });

  // Admin Product Endpoints
  app.get('/api/admin/products', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const categoryId = req.query.category && objectId.safeParse(req.query.category).success ? req.query.category : undefined;
    const isAvailable = req.query.available !== undefined ? req.query.available === 'true' : undefined;
    const products = await repository.allAdminProducts({
      categoryId,
      search: req.query.search,
      isAvailable,
    });
    success(res, products);
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = validateCreateProduct(req.body);
    const category = await repository.findCategoryById(data.categoryId);
    if (!category) {
      throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'الفئة المحددة غير موجودة.');
    }
    const baseSlug = generateSlug(data.name, 'meal');
    const slug = await makeUniqueSlug(repository.models.Product, baseSlug);
    const created = await repository.createProduct({ ...data, slug });
    success(res, { ...created, id: String(created._id) }, 201);
  });

  app.patch('/api/admin/products/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الوجبة غير صالح.');
    }
    const data = validateUpdateProduct(req.body);
    if (data.categoryId) {
      const category = await repository.findCategoryById(data.categoryId);
      if (!category) {
        throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'الفئة المحددة غير موجودة.');
      }
    }
    const existing = await repository.findProductById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'الوجبة غير موجودة.');
    }
    const updated = await repository.updateProduct(req.params.id, data);
    success(res, { ...updated, id: String(updated._id) });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الوجبة غير صالح.');
    }
    const existing = await repository.findProductById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'الوجبة غير موجودة.');
    }
    const activeOffers = await repository.countActiveOffersForProduct(req.params.id);
    if (activeOffers > 0) {
      throw new ApiError(409, 'PRODUCT_IN_OFFER', 'لا يمكن حذف الوجبة لارتباطها بعرض ترويجي نشط حاليًا. يرجى تعديل أو إيقاف العرض أولاً.');
    }
    await repository.detachOffersForProduct(req.params.id);
    await repository.deleteProduct(req.params.id);
    success(res, { deleted: true, id: req.params.id });
  });

  // Admin Offer Endpoints
  app.get('/api/admin/offers', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const offers = await repository.allAdminOffers();
    success(res, offers);
  });

  app.get('/api/admin/offers/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف العرض غير صالح.');
    }
    const offer = await repository.findOfferById(req.params.id);
    if (!offer) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'العرض غير موجود.');
    }
    success(res, offer);
  });

  app.post('/api/admin/offers', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = validateCreateOffer(req.body);
    const product = await repository.findProductById(data.productId);
    if (!product) {
      throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'الوجبة المحددة غير موجودة.');
    }
    const baseSlug = generateSlug(data.title, 'offer');
    const slug = await makeUniqueSlug(repository.models.Offer, baseSlug);
    const offerData = {
      ...data,
      slug,
      image: data.image || product.image || '',
    };
    const created = await repository.createOffer(offerData);
    success(res, { ...created, id: String(created._id) }, 201);
  });

  app.patch('/api/admin/offers/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف العرض غير صالح.');
    }
    const data = validateUpdateOffer(req.body);
    const existing = await repository.findOfferById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'العرض غير موجود.');
    }
    if (data.productId) {
      const product = await repository.findProductById(data.productId);
      if (!product) {
        throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'الوجبة المحددة غير موجودة.');
      }
    }
    const finalOriginal = data.originalPrice !== undefined ? data.originalPrice : existing.originalPrice;
    const finalOffer = data.offerPrice !== undefined ? data.offerPrice : existing.offerPrice;
    if (finalOffer > finalOriginal) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'سعر العرض لا يمكن أن يتجاوز السعر الأصلي.');
    }
    const finalStart = data.startDate !== undefined ? new Date(data.startDate) : new Date(existing.startDate);
    const finalEnd = data.endDate !== undefined ? new Date(data.endDate) : new Date(existing.endDate);
    if (finalEnd < finalStart) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'تاريخ انتهاء العرض يجب أن يلي تاريخ البداية.');
    }

    const updated = await repository.updateOffer(req.params.id, data);
    success(res, { ...updated, id: String(updated._id) });
  });

  app.delete('/api/admin/offers/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف العرض غير صالح.');
    }
    const existing = await repository.findOfferById(req.params.id);
    if (!existing) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'العرض غير موجود.');
    }
    await repository.deleteOffer(req.params.id);
    success(res, { deleted: true, id: req.params.id });
  });

  // Admin Settings Endpoints
  app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const settings = await repository.store();
    success(res, publicStore(settings));
  });

  app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const data = validateUpdateSettings(req.body);
    const updated = await repository.updateStoreSettings(data);
    success(res, publicStore(updated));
  });

  // Admin Orders Endpoints
  app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { status, page = 1, limit = 50 } = req.query;
    const result = await repository.allAdminOrders({
      status: typeof status === 'string' ? status : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    success(res, result);
  });

  app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الطلب غير صالح.');
    }
    const order = await repository.findAdminOrderById(req.params.id);
    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'الطلب غير موجود.');
    }
    success(res, order);
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!objectId.safeParse(req.params.id).success) {
      throw new ApiError(400, 'INVALID_ID', 'معرّف الطلب غير صالح.');
    }
    const data = validateUpdateOrderStatus(req.body);
    const updated = await repository.updateAdminOrderStatus(req.params.id, data.status);
    success(res, updated);
  });

  // Admin Push Notification Endpoints
  app.get('/api/admin/push/public-key', requireAdmin, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    success(res, { publicKey: pushService.getPublicKey() });
  });

  app.post('/api/admin/push/subscribe', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const parseResult = subscribeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(400, 'INVALID_SUBSCRIPTION', parseResult.error.issues[0]?.message || 'بيانات الاشتراك غير صالحة.');
    }
    const subscription = await pushService.subscribe({
      adminId: req.admin.adminId,
      endpoint: parseResult.data.endpoint,
      keys: parseResult.data.keys,
      device: parseResult.data.device,
    });
    success(res, { subscribed: true, id: String(subscription._id) }, 201);
  });

  app.post('/api/admin/push/unsubscribe', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const parseResult = unsubscribeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(400, 'INVALID_SUBSCRIPTION', parseResult.error.issues[0]?.message || 'بيانات الاشتراك غير صالحة.');
    }
    await pushService.unsubscribe({
      endpoint: parseResult.data.endpoint,
      adminId: req.admin.adminId,
    });
    success(res, { unsubscribed: true });
  });

  app.get('/api/admin/push/status', requireAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : undefined;
    const status = await pushService.getStatus({
      adminId: req.admin.adminId,
      endpoint,
    });
    success(res, status);
  });

  if (config.serveFrontend) serveFrontend(app, frontendDir);
  app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'المسار المطلوب غير موجود.')));
  app.use(errorHandler);
  return app;
}
