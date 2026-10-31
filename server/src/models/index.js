import mongoose from 'mongoose';
const { Schema } = mongoose;
const money = { type: Number, required: true, min: 0, max: 100000, validate: { validator: (value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < .000001, message: 'السعر يجب أن يكون غير سالب وبمنزلتين عشريتين كحد أقصى.' } };
const text = (max, required = false) => ({ type: String, trim: true, maxlength: max, required });
const slug = { type: String, required: true, unique: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ };
const options = { timestamps: true, bufferCommands: false, strict: 'throw' };
const imageMetadata = () => ({ imageUrl: text(1000), imagePublicId: { ...text(300), default: '' }, imageVersion: { type: Number, min: 1, default: null } });

export function createModels(connection) {
  const category = new Schema({ ...imageMetadata(), name: text(120, true), slug, image: text(1000), icon: text(40), description: text(1000), sortOrder: { type: Number, default: 0 }, isActive: { type: Boolean, default: true } }, options);
  const product = new Schema({ ...imageMetadata(), name: text(120, true), slug, description: text(1000), price: money, image: text(1000), categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true }, isAvailable: { type: Boolean, default: true }, isFeatured: { type: Boolean, default: false }, sortOrder: { type: Number, default: 0 }, badge: text(80), isSpicy: { type: Boolean, default: false } }, options);
  product.index({ categoryId: 1, isAvailable: 1, sortOrder: 1 });
  const offer = new Schema({ ...imageMetadata(), slug, title: text(120, true), description: text(1000), image: text(1000), originalPrice: money, offerPrice: money, startDate: { type: Date, required: true }, endDate: { type: Date, required: true, validate: { validator: function (value) { const update = this.getUpdate ? (this.getUpdate().$set || this.getUpdate()) : null; const start = this.startDate ?? update?.startDate ?? this.getUpdate?.().$setOnInsert?.startDate ?? this.get?.('startDate'); if (start === undefined || start === null) return true; return new Date(value) >= new Date(start); }, message: 'تاريخ انتهاء العرض يجب أن يلي تاريخ البداية.' } }, isActive: { type: Boolean, default: false }, productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null } }, options);
  offer.path('offerPrice').validate(function (value) { const update = this.getUpdate ? (this.getUpdate().$set || this.getUpdate()) : null; const original = this.originalPrice ?? update?.originalPrice ?? this.getUpdate?.().$setOnInsert?.originalPrice ?? this.get?.('originalPrice'); if (original === undefined || original === null) return true; return value <= original; }, 'سعر العرض لا يتجاوز السعر الأصلي.');
  offer.index({ isActive: 1, startDate: 1, endDate: 1, productId: 1 });
  const settings = new Schema({ _id: { type: String, default: 'store', enum: ['store'] }, restaurantName: { ...text(120, true), default: 'مطعم ومطبخ العائلة' }, isOpen: { type: Boolean, default: true }, acceptingOrders: { type: Boolean, default: true }, pickupEnabled: { type: Boolean, default: true }, deliveryEnabled: { type: Boolean, default: true }, announcement: { ...text(1000), default: '' }, phone: { ...text(32), default: '' } }, options);
  const item = new Schema({ productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, offerId: { type: Schema.Types.ObjectId, ref: 'Offer', default: null }, name: text(120, true), image: text(1000), quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger }, unitPrice: money, lineTotal: { ...money, max: 9900000 } }, { _id: false, strict: 'throw' });
  const order = new Schema({
    orderNumber: { type: String, required: true, unique: true },
    submissionId: { type: String, required: true, unique: true, select: false },
    requestFingerprint: { type: String, required: true, select: false },
    accessTokenHash: { type: String, required: true, select: false },
    customer: { name: text(120, true), phone: text(32, true) },
    fulfillmentType: { type: String, enum: ['pickup', 'delivery'], required: true },
    deliveryAddress: { type: String, maxlength: 1000, default: null, required: function () { return this.fulfillmentType === 'delivery'; } },
    notes: { ...text(1000), default: '' },
    items: { type: [item], required: true, validate: (value) => value.length > 0 && value.length <= 100 },
    productsSubtotal: { ...money, max: 990000000 },
    status: { type: String, enum: ['new', 'received', 'prepared', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'], default: 'new', required: true },
  }, { ...options, writeConcern: { w: 'majority' } });
  order.index({ createdAt: -1 });
  order.index({ status: 1, createdAt: -1 });
  order.pre('validate', function () { if (this.fulfillmentType === 'pickup') this.deliveryAddress = null; });
  const admin = new Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 50, match: /^[a-z0-9_-]+$/ },
    passwordHash: { type: String, required: true },
    name: { ...text(120), default: 'مدير المطعم' },
    role: { type: String, enum: ['owner', 'admin'], default: 'owner' },
  }, options);
  const adminSession = new Schema({
    sessionId: { type: String, required: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  }, options);
  adminSession.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const adminPushSubscription = new Schema({
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    device: {
      userAgent: { type: String, default: '' },
      platform: { type: String, default: '' },
      label: { type: String, default: '' },
    },
    lastDeliveredAt: { type: Date, default: null },
  }, options);
  adminPushSubscription.index({ adminId: 1 });

  const pushNotificationJob = new Schema({
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
  }, options);
  pushNotificationJob.index({ status: 1, attempts: 1 });

  const imageCleanupJob = new Schema({ imagePublicId: text(300, true), imageUrl: text(1000, true), cloudName: text(100, true), nextAttemptAt: { type: Date, default: Date.now } }, options);
  imageCleanupJob.index({ cloudName: 1, imagePublicId: 1 }, { unique: true });
  imageCleanupJob.index({ nextAttemptAt: 1 });
  const schemas = {
    ImageCleanupJob: imageCleanupJob,
    Category: category,
    Product: product,
    Offer: offer,
    Order: order,
    StoreSettings: settings,
    Admin: admin,
    AdminSession: adminSession,
    AdminPushSubscription: adminPushSubscription,
    PushNotificationJob: pushNotificationJob,
  };
  return Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, connection.models[name] || connection.model(name, schema)]));
}

export async function ensureIndexes(models) { await Promise.all(Object.values(models).map((model) => model.createIndexes())); }
