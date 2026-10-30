import { apiRequest, ApiClientError } from './apiClient.js';
import { validateCheckout } from '../utils/checkoutValidation.js';
import { createAccessToken, createUUID } from '../utils/identifiers.js';

const PENDING_KEY = 'family-menu-pending-request-v1';
const inFlight = new Map();
let pendingAttempt;
function readPending() {
  if (pendingAttempt !== undefined) return pendingAttempt;
  try { pendingAttempt = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { pendingAttempt = null; }
  return pendingAttempt;
}
function remember(attempt) {
  pendingAttempt = attempt;
  try { if (attempt) sessionStorage.setItem(PENDING_KEY, JSON.stringify(attempt)); else sessionStorage.removeItem(PENDING_KEY); } catch { /* API submission still works with in-memory retry identity. */ }
}
function validOrder(order) {
  return order && /^[a-f\d]{24}$/i.test(order.id) && typeof order.orderNumber === 'string'
    && ['new', 'received', 'prepared', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(order.status)
    && typeof order.customer?.name === 'string' && ['pickup', 'delivery'].includes(order.fulfillmentType)
    && Array.isArray(order.items) && order.items.length > 0 && Number.isFinite(order.productsSubtotal) && order.productsSubtotal >= 0;
}

export async function submitOrder(input, { signal } = {}) {
  const { errors, values } = validateCheckout(input.checkout);
  if (Object.keys(errors).length) {
    const error = new ApiClientError('VALIDATION_ERROR', 'راجع بيانات الطلب قبل الإرسال.'); error.fields = errors; throw error;
  }
  if (!input.items?.length) throw new ApiClientError('EMPTY_CART', 'سلّتك فارغة. أضف وجباتك المفضلة أولًا.');
  if (input.items.some((item) => !item.isAvailable || !/^[a-f\d]{24}$/i.test(item.databaseId || ''))) throw new ApiClientError('UNAVAILABLE_PRODUCT', 'أحد الأصناف غير متوفر حاليًا. راجع السلّة قبل المتابعة.');
  const logicalRequest = JSON.stringify({ customer: { name: values.name, phone: values.phone }, fulfillmentType: values.fulfillmentType, deliveryAddress: values.deliveryAddress, notes: values.notes, items: input.items.map((item) => ({ productId: item.databaseId, quantity: item.quantity })).sort((a, b) => a.productId.localeCompare(b.productId)) });
  let attempt = readPending();
  if (!attempt || attempt.logicalRequest !== logicalRequest || !/^[A-Za-z0-9_-]{43}$/.test(attempt.payload?.confirmationToken || '')) {
    attempt = { logicalRequest, payload: { ...JSON.parse(logicalRequest), items: input.items.map((item) => ({ productId: item.databaseId, offerId: item.offerId || null, quantity: item.quantity, expectedUnitPrice: item.price })), expectedProductsSubtotal: input.expectedProductsSubtotal, submissionId: attempt ? createUUID() : input.submissionKey || createUUID(), confirmationToken: createAccessToken() } };
    remember(attempt);
  }
  const { payload } = attempt;
  if (inFlight.has(payload.submissionId)) return inFlight.get(payload.submissionId);
  const request = apiRequest('/orders', { method: 'POST', body: payload, signal }).then(({ data }) => {
    if (!validOrder(data?.order)) throw new ApiClientError('INVALID_RESPONSE', 'تعذّر التحقق من تأكيد الطلب. حاول مجددًا بنفس البيانات؛ ستبقى سلّتك كما هي.');
    remember(null);
    return { ...data.order, confirmationToken: payload.confirmationToken };
  }).catch((error) => {
    if (error.status >= 400 && error.status < 500 && error.status !== 429) remember(null);
    if (error.details?.fields) error.fields = Object.fromEntries(Object.entries(error.details.fields).map(([key, message]) => [key.replace(/^customer\./, ''), message]));
    throw error;
  }).finally(() => inFlight.delete(payload.submissionId));
  inFlight.set(payload.submissionId, request);
  return request;
}

export async function loadOrder(id, token, { signal } = {}) {
  if (!/^[a-f\d]{24}$/i.test(id || '') || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) return null;
  try {
    const { data } = await apiRequest(`/orders/${id}`, { token, signal });
    if (!validOrder(data)) throw new ApiClientError('INVALID_RESPONSE', 'تعذّر قراءة تفاصيل الطلب. حاول مجددًا.');
    return data;
  } catch (error) { if (error.status === 404) return null; throw error; }
}
