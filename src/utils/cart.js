export const CART_STORAGE_KEY = 'family-restaurant-cart-v1';
export const MAX_QUANTITY = 99;

export function normalizeCart(value, products) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const product = products?.find((entry) => entry.id === item.productId);
    const id = product?.id || item.productId;
    if ((products && !product) || typeof id !== 'string' || id.length > 120 || seen.has(id) || !Number.isInteger(item.quantity) || item.quantity <= 0) return [];
    seen.add(id);
    return [{ productId: id, quantity: Math.min(item.quantity, MAX_QUANTITY) }];
  });
}

export function readCart(storage, products) {
  try { return normalizeCart(JSON.parse(storage.getItem(CART_STORAGE_KEY) || '[]'), products); }
  catch { return []; }
}

export function cartReducer(state, action) {
  if (action.type === 'clear') return [];
  if (action.type === 'remove') return state.filter((item) => item.productId !== action.productId);
  if (action.type === 'change') {
    const existing = state.find((item) => item.productId === action.productId);
    const quantity = Math.min(MAX_QUANTITY, Math.max(0, (existing?.quantity || 0) + action.delta));
    if (quantity === 0) return state.filter((item) => item.productId !== action.productId);
    if (!existing) return [...state, { productId: action.productId, quantity }];
    return state.map((item) => item.productId === action.productId ? { ...item, quantity } : item);
  }
  return state;
}

export function getCartItems(cart, products, activeOffers = []) {
  return cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return [];
    const offer = activeOffers.find((entry) => entry.productId === product.id);
    const price = offer ? Math.min(product.price, offer.offerPrice) : product.price;
    return [{ ...product, price, offerId: offer?.id || null, quantity: item.quantity, subtotal: Math.round(price * 100) * item.quantity / 100 }];
  });
}

export function getCartTotals(items) {
  return items.reduce((totals, item) => ({
    count: totals.count + item.quantity, total: totals.total + item.subtotal,
  }), { count: 0, total: 0 });
}
