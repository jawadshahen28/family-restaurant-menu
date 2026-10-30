import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../utils/errors.js';
import { isCurrentOffer, publicStore } from './menuService.js';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const cents = (amount) => Math.round(amount * 100);
export function normalizeOrderStatus(status) {
  if (status === 'confirmed' || status === 'new') return 'new';
  if (status === 'preparing' || status === 'received') return 'received';
  if (status === 'ready' || status === 'completed' || status === 'prepared') return 'prepared';
  return 'new';
}
export function fingerprint(payload) {
  const canonical = { customer: payload.customer, fulfillmentType: payload.fulfillmentType, deliveryAddress: payload.deliveryAddress, notes: payload.notes, items: [...payload.items].sort((a, b) => a.productId.localeCompare(b.productId)), expectedProductsSubtotal: payload.expectedProductsSubtotal, accessTokenHash: hashToken(payload.confirmationToken) };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export function orderDto(order) {
  return { id: String(order._id), orderNumber: order.orderNumber, customer: order.customer, fulfillmentType: order.fulfillmentType, deliveryAddress: order.deliveryAddress, notes: order.notes, items: order.items.map((item) => ({ productId: String(item.productId), offerId: item.offerId ? String(item.offerId) : null, name: item.name, image: item.image, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })), productsSubtotal: order.productsSubtotal, status: normalizeOrderStatus(order.status), createdAt: order.createdAt, updatedAt: order.updatedAt };
}
function validReplay(order, requestFingerprint) {
  if (order.requestFingerprint !== requestFingerprint) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'معرّف هذه المحاولة مستخدم لطلب ببيانات مختلفة. راجع الطلب وابدأ محاولة جديدة.');
  return { order: orderDto(order), replayed: true };
}

export function createOrderService(repository, { now = Date.now, number = () => `FAM-${new Date(now()).toISOString().slice(0,10).replaceAll('-', '')}-${randomBytes(8).toString('hex').toUpperCase()}`, pushService = null } = {}) {
  return {
    async submit(payload) {
      const requestFingerprint = fingerprint(payload);
      const existing = await repository.orderBySubmission(payload.submissionId);
      if (existing) return validReplay(existing, requestFingerprint);
      const settings = publicStore(await repository.store());
      if (!settings.isOpen) throw new ApiError(409, 'STORE_CLOSED', 'المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.');
      if (!settings.acceptingOrders) throw new ApiError(409, 'ORDERS_PAUSED', 'استقبال الطلبات متوقف حاليًا. يمكنك تصفح المنيو والمحاولة لاحقًا.');
      if (!settings[`${payload.fulfillmentType}Enabled`]) throw new ApiError(409, 'FULFILLMENT_DISABLED', payload.fulfillmentType === 'delivery' ? 'التوصيل غير متاح حاليًا. يمكنك اختيار الاستلام من المطعم.' : 'الاستلام من المطعم غير متاح حاليًا.');
      const ids = payload.items.map((item) => item.productId);
      const [products, offers] = await Promise.all([repository.productsByIds(ids), repository.offersForProducts(ids)]);
      const currentTime = now();
      const lines = payload.items.map((item) => {
        const product = products.find((entry) => String(entry._id) === item.productId);
        if (!product || !product.isAvailable || !product.categoryId?.isActive) throw new ApiError(409, 'UNAVAILABLE_PRODUCT', product ? `«${product.name}» غير متوفر حاليًا. راجع السلّة.` : 'أحد الأصناف لم يعد متوفرًا. راجع السلّة.');
        let offer;
        if (item.offerId) {
          offer = offers.find((entry) => String(entry._id) === item.offerId && String(entry.productId) === item.productId);
          if (!offer || !isCurrentOffer(offer, currentTime)) throw new ApiError(409, 'OFFER_UNAVAILABLE', 'انتهى عرض أحد الأصناف أو أصبح غير متاح. راجع الأسعار الجديدة قبل التأكيد.');
        } else {
          offer = offers.find((entry) => String(entry.productId) === item.productId && isCurrentOffer(entry, currentTime));
        }
        const unitCents = cents(offer ? Math.min(offer.offerPrice, product.price) : product.price);
        return { productId: product._id, offerId: offer?._id || null, name: product.name, image: product.image, quantity: item.quantity, unitPrice: unitCents / 100, lineTotal: unitCents * item.quantity / 100 };
      });
      const subtotal = lines.reduce((sum, line) => sum + cents(line.lineTotal), 0) / 100;
      if (cents(subtotal) !== cents(payload.expectedProductsSubtotal) || lines.some((line, index) => cents(line.unitPrice) !== cents(payload.items[index].expectedUnitPrice))) {
        throw new ApiError(409, 'PRICE_CHANGED', 'تغيّرت أسعار بعض الأصناف. راجع المجموع الجديد ثم أكّد الطلب مجددًا.', { productsSubtotal: subtotal, updatedItems: lines.map((line) => ({ productId: String(line.productId), offerId: line.offerId ? String(line.offerId) : null, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })) });
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const order = await repository.createOrder({ orderNumber: number(), submissionId: payload.submissionId, requestFingerprint, accessTokenHash: hashToken(payload.confirmationToken), customer: payload.customer, fulfillmentType: payload.fulfillmentType, deliveryAddress: payload.deliveryAddress, notes: payload.notes, items: lines, productsSubtotal: subtotal, status: 'new' });
          if (pushService && typeof pushService.enqueueNewOrderNotification === 'function') {
            try {
              pushService.enqueueNewOrderNotification({ orderId: order._id, orderNumber: order.orderNumber });
            } catch (pushErr) {
              console.warn('Failed to enqueue order push notification:', pushErr.message);
            }
          }
          return { order: orderDto(order), replayed: false };
        } catch (error) {
          if (error.code !== 11000) throw error;
          const winner = await repository.orderBySubmission(payload.submissionId);
          if (winner) return validReplay(winner, requestFingerprint);
          if (!error.keyPattern?.orderNumber || attempt === 2) throw error;
        }
      }
    },
    async retrieve(id, token) {
      const order = await repository.orderByAccess(id, hashToken(token));
      if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'الطلب غير موجود أو رابط الوصول غير صحيح.');
      return orderDto(order);
    },
  };
}
