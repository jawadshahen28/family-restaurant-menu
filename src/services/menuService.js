import { apiRequest } from './apiClient';
import { getStore } from './storeService';
let pending;
let cached;
export function clearMenuCache() {
  cached = null;
}

export function getMenu({ force = false } = {}) {
  if (pending) return pending;
  if (!force && cached && Date.now() - cached.loadedAt < 30000) return Promise.resolve(cached);
  pending = Promise.all([apiRequest('/categories'), apiRequest('/products'), apiRequest('/offers'), getStore()]).then(([categories, products, offers, store]) => {
    cached = { categories: categories.data, products: products.data, offers: offers.data, store: store.data, serverTimeOffset: Date.parse(offers.meta.serverTime) - Date.now() || 0, loadedAt: Date.now() };
    return cached;
  }).finally(() => { pending = null; });
  return pending;
}
