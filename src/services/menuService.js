import { apiRequest } from './apiClient.js';
import { getStore } from './storeService.js';
let pending;
let cached;
let revision = 0;
export const MENU_CHANGE_EVENT = 'family-menu-changed';
export const MENU_CHANGE_KEY = 'family-menu-revision';
export function clearMenuCache() {
  cached = null;
  pending = null;
  revision++;
}

export function notifyMenuChanged() {
  clearMenuCache();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MENU_CHANGE_EVENT));
  try { window.localStorage.setItem(MENU_CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* Refresh still works without storage. */ }
}

export function getMenu({ force = false } = {}) {
  if (pending) return pending;
  if (!force && cached && Date.now() - cached.loadedAt < 30000) return Promise.resolve(cached);
  const requestRevision = revision;
  const request = Promise.all([apiRequest('/categories'), apiRequest('/products'), apiRequest('/offers'), getStore()]).then(([categories, products, offers, store]) => {
    if (requestRevision !== revision) return getMenu();
    cached = { categories: categories.data, products: products.data, offers: offers.data, store: store.data, serverTimeOffset: Date.parse(offers.meta.serverTime) - Date.now() || 0, loadedAt: Date.now() };
    return cached;
  }).catch(error => { if (requestRevision !== revision) return getMenu(); throw error; })
    .finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}
