import { normalizeOrderStatus } from './orderService.js';
import { ApiError } from '../utils/errors.js';
import { imageResponse } from '../utils/images.js';

export function createRepository(models) {
  const { Category, Product, Offer, Order, StoreSettings, Admin, AdminSession, AdminPushSubscription, PushNotificationJob, ImageCleanupJob } = models;
  return {
    async healthy() { return Category.db.readyState === 1; },
    async categories() { return Category.find({ isActive: true }).sort({ sortOrder: 1, _id: 1 }).lean(); },
    async products(category) {
      const categories = await Category.find({ isActive: true, ...(category ? /^[a-fA-F0-9]{24}$/.test(category) ? { _id: category } : { slug: category } : {}) }).select('_id').lean();
      return Product.find({ isAvailable: true, categoryId: { $in: categories.map((entry) => entry._id) } }).sort({ sortOrder: 1, _id: 1 }).populate('categoryId', 'slug isActive').lean();
    },
    async productsByIds(ids) { return Product.find({ _id: { $in: ids } }).populate('categoryId', 'slug isActive').lean(); },
    async offersForProducts(ids) { return Offer.find({ productId: { $in: ids } }).sort({ offerPrice: 1, _id: 1 }).lean(); },
    async currentOffers(now) { return Offer.find({ isActive: true, startDate: { $lte: new Date(now) }, endDate: { $gte: new Date(now) }, productId: { $ne: null } }).sort({ offerPrice: 1, _id: 1 }).lean(); },
    async store() { return StoreSettings.findById('store').lean(); },
    async orderBySubmission(submissionId) { return Order.findOne({ submissionId }).select('+requestFingerprint +accessTokenHash +submissionId').lean(); },
    async createOrder(data) { return (await Order.create(data)).toObject(); },
    async orderByAccess(id, hash) { return Order.findOne({ _id: id, accessTokenHash: hash }).lean(); },
    async findAdminByUsername(username) { return Admin.findOne({ username: username.toLowerCase() }).lean(); },
    async findAdminById(id) { return Admin.findById(id).select('-passwordHash').lean(); },
    async createAdmin(data) { return (await Admin.create({ ...data, username: data.username.toLowerCase() })).toObject(); },
    async updateAdminPassword(username, passwordHash) { return Admin.updateOne({ username: username.toLowerCase() }, { passwordHash }); },
    async createAdminSession(data) { return (await AdminSession.create(data)).toObject(); },
    async findAdminSession(sessionId) { return AdminSession.findOne({ sessionId }).populate('adminId', 'username name role').lean(); },
    async touchAdminSession(sessionId, expiresAt) { return AdminSession.updateOne({ sessionId }, { expiresAt }); },
    async deleteAdminSession(sessionId) { return AdminSession.deleteOne({ sessionId }); },
    async deleteAdminSessionsForAdmin(adminId) { return AdminSession.deleteMany({ adminId }); },
    models,
    async queueImageDeletion(asset) {
      return ImageCleanupJob.findOneAndUpdate({ cloudName: asset.cloudName, imagePublicId: asset.imagePublicId }, { $set: { imageUrl: asset.imageUrl, nextAttemptAt: new Date() } }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
    },
    async pendingImageDeletions() { return ImageCleanupJob.find({ nextAttemptAt: { $lte: new Date() } }).sort({ nextAttemptAt: 1 }).limit(20).lean(); },
    async deferImageDeletion(id) { return ImageCleanupJob.updateOne({ _id: id }, { $set: { nextAttemptAt: new Date(Date.now() + 60000) } }); },
    async completeImageDeletion(id) { return ImageCleanupJob.deleteOne({ _id: id }); },
    async imageIsReferenced(asset) {
      const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const url = new RegExp(`^https://res\\.cloudinary\\.com/${escape(asset.cloudName)}/image/upload/(?:v\\d+/)?${escape(asset.imagePublicId)}\\.[a-zA-Z0-9]+(?:\\?.*)?$`);
      const query = { $or: [{ imagePublicId: asset.imagePublicId }, { imageUrl: url }, { image: url }] };
      const results = await Promise.all([Category.exists(query), Product.exists(query), Offer.exists(query), Order.exists({ 'items.image': url })]);
      return results.some(Boolean);
    },
    async clearInheritedOfferImages(productId, oldUrl) {
      return Offer.updateMany({ productId, $and: [{ $or: [{ image: oldUrl }, { imageUrl: oldUrl }] }, { $or: [{ imagePublicId: '' }, { imagePublicId: { $exists: false } }] }] }, { $set: { image: '', imageUrl: '', imagePublicId: '', imageVersion: null } });
    },
    async allCategoriesWithCounts() {
      const [categories, counts] = await Promise.all([
        Category.find().sort({ sortOrder: 1, _id: 1 }).lean(),
        Product.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
      ]);
      const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
      return categories.map((cat) => ({
        ...imageResponse(cat),
        id: String(cat._id),
        productCount: countMap[String(cat._id)] || 0,
      }));
    },
    async findCategoryById(id) { return imageResponse(await Category.findById(id).lean()); },
    async findCategoryBySlug(slug) { return Category.findOne({ slug }).lean(); },
    async createCategory(data) { return imageResponse((await Category.create(data)).toObject()); },
    async updateCategory(id, data) { return imageResponse(await Category.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).lean()); },
    async deleteCategory(id) { return Category.findByIdAndDelete(id); },
    async countProductsForCategory(categoryId) { return Product.countDocuments({ categoryId }); },

    async allAdminProducts({ categoryId, search, isAvailable } = {}) {
      const query = {};
      if (categoryId) query.categoryId = categoryId;
      if (search && typeof search === 'string' && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [{ name: new RegExp(escaped, 'i') }, { description: new RegExp(escaped, 'i') }];
      }
      if (typeof isAvailable === 'boolean') query.isAvailable = isAvailable;
      const products = await Product.find(query).sort({ sortOrder: 1, _id: 1 }).populate('categoryId', 'name slug isActive').lean();
      return products.map((prod) => ({
        ...imageResponse(prod),
        id: String(prod._id),
      }));
    },
    async findProductById(id) { return imageResponse(await Product.findById(id).populate('categoryId', 'name slug isActive').lean()); },
    async createProduct(data) {
      const created = await Product.create(data);
      return imageResponse((await created.populate('categoryId', 'name slug isActive')).toObject());
    },
    async updateProduct(id, data) {
      return imageResponse(await Product.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).populate('categoryId', 'name slug isActive').lean());
    },
    async deleteProduct(id) { return Product.findByIdAndDelete(id); },
    async countActiveOffersForProduct(productId) {
      return Offer.countDocuments({ productId, isActive: true, endDate: { $gte: new Date() } });
    },
    async detachOffersForProduct(productId) {
      return Offer.updateMany({ productId }, { $set: { productId: null } });
    },
    async allAdminOffers() {
      const offers = await Offer.find().sort({ createdAt: -1, _id: -1 }).populate('productId', 'name price image imageUrl imagePublicId imageVersion isAvailable categoryId').lean();
      return offers.map((off) => ({
        ...imageResponse(off),
        productId: imageResponse(off.productId),
        id: String(off._id),
      }));
    },
    async findOfferById(id) {
      const offer = await Offer.findById(id).populate('productId', 'name price image imageUrl imagePublicId imageVersion isAvailable categoryId').lean();
      if (!offer) return null;
      return { ...imageResponse(offer), productId: imageResponse(offer.productId), id: String(offer._id) };
    },
    async findOfferBySlug(slug) {
      return Offer.findOne({ slug }).lean();
    },
    async createOffer(data) {
      const created = await Offer.create(data);
      return imageResponse((await created.populate('productId', 'name price image imageUrl imagePublicId imageVersion isAvailable categoryId')).toObject());
    },
    async updateOffer(id, data) {
      return imageResponse(await Offer.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).populate('productId', 'name price image imageUrl imagePublicId imageVersion isAvailable categoryId').lean());
    },
    async deleteOffer(id) {
      return Offer.findByIdAndDelete(id);
    },
    async updateStoreSettings(data) {
      return StoreSettings.findByIdAndUpdate('store', { $set: data }, { returnDocument: 'after', upsert: true, runValidators: true }).lean();
    },
    async allAdminOrders({ status, page = 1, limit = 50 } = {}) {
      const query = {};
      if (status && status !== 'all') {
        if (status === 'new') query.status = { $in: ['new', 'confirmed'] };
        else if (status === 'received') query.status = { $in: ['received', 'preparing'] };
        else if (status === 'prepared') query.status = { $in: ['prepared', 'ready', 'completed'] };
        else query.status = status;
      }
      const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
      const take = Math.min(100, Math.max(1, limit));

      const [orders, total, newCount] = await Promise.all([
        Order.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(take).lean(),
        Order.countDocuments(query),
        Order.countDocuments({ status: { $in: ['new', 'confirmed'] } }),
      ]);

      return {
        orders: orders.map((ord) => ({
          ...ord,
          id: String(ord._id),
          status: normalizeOrderStatus(ord.status),
        })),
        total,
        newCount,
        page,
        limit: take,
      };
    },
    async findAdminOrderById(id) {
      const order = await Order.findById(id).lean();
      if (!order) return null;
      return {
        ...order,
        id: String(order._id),
        status: normalizeOrderStatus(order.status),
      };
    },
    async updateAdminOrderStatus(id, newStatus) {
      let allowedQuery;
      if (newStatus === 'received') {
        allowedQuery = { _id: id, status: { $in: ['new', 'confirmed'] } };
      } else if (newStatus === 'prepared') {
        allowedQuery = { _id: id, status: { $in: ['received', 'preparing'] } };
      } else {
        throw new ApiError(400, 'INVALID_STATUS', 'الحالة المطلوبة غير صالحة.');
      }

      const updated = await Order.findOneAndUpdate(
        allowedQuery,
        { $set: { status: newStatus } },
        { returnDocument: 'after' }
      ).lean();

      if (updated) {
        return {
          ...updated,
          id: String(updated._id),
          status: normalizeOrderStatus(updated.status),
        };
      }

      const existing = await Order.findById(id).lean();
      if (!existing) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'الطلب غير موجود.');
      }

      const current = normalizeOrderStatus(existing.status);
      if (current === newStatus) {
        throw new ApiError(400, 'SAME_STATUS', 'الطلب بهذه الحالة بالفعل.');
      }
      if (current === 'new' && newStatus === 'prepared') {
        throw new ApiError(400, 'SKIPPED_STATUS', 'لا يمكن تخطي مرحلة استلام الطلب إلى التجهيز مباشرة.');
      }
      if (current === 'prepared') {
        throw new ApiError(400, 'ORDER_COMPLETED', 'تم تجهيز الطلب مسبقًا ولا يمكن تغيير حالته.');
      }
      if (current === 'received' && newStatus === 'new') {
        throw new ApiError(400, 'STATUS_REVERSAL', 'لا يمكن التراجع عن استلام الطلب.');
      }

      throw new ApiError(409, 'CONCURRENT_UPDATE', 'تم تحديث حالة الطلب من جهاز آخر. يرجى تحديث الصفحة.');
    },

    async upsertPushSubscription({ adminId, endpoint, keys, device }) {
      return AdminPushSubscription.findOneAndUpdate(
        { endpoint },
        {
          $set: {
            adminId,
            keys,
            device: device || {},
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      ).lean();
    },

    async deletePushSubscription(endpoint, adminId) {
      const query = { endpoint };
      if (adminId) query.adminId = adminId;
      return AdminPushSubscription.deleteOne(query);
    },

    async findPushSubscriptionByEndpoint(endpoint) {
      return AdminPushSubscription.findOne({ endpoint }).lean();
    },

    async countPushSubscriptions(adminId) {
      const query = adminId ? { adminId } : {};
      return AdminPushSubscription.countDocuments(query);
    },

    async allPushSubscriptions() {
      return AdminPushSubscription.find().lean();
    },

    async updatePushSubscriptionLastDelivered(endpoint) {
      return AdminPushSubscription.updateOne({ endpoint }, { $set: { lastDeliveredAt: new Date() } });
    },

    async enqueuePushJob({ orderId, orderNumber }) {
      try {
        return (await PushNotificationJob.create({ orderId, orderNumber })).toObject();
      } catch (err) {
        if (err.code === 11000) {
          return PushNotificationJob.findOne({ orderId }).lean();
        }
        throw err;
      }
    },

    async claimNextPushJob() {
      return PushNotificationJob.findOneAndUpdate(
        { status: 'pending', attempts: { $lt: 5 } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
      ).lean();
    },

    async completePushJob(id) {
      return PushNotificationJob.findByIdAndUpdate(id, { $set: { status: 'completed', processedAt: new Date() } });
    },

    async failPushJob(id, error, willRetry) {
      return PushNotificationJob.findByIdAndUpdate(id, {
        $set: {
          status: willRetry ? 'pending' : 'failed',
          error: error ? String(error) : null,
        },
      });
    },
  };
}
