import { apiRequest } from './apiClient.js';
import { notifyMenuChanged } from './menuService.js';

export async function getAdminOffers() {
  const result = await apiRequest('/admin/offers', { credentials: 'same-origin' });
  return result.data;
}

export async function getAdminOffer(id) {
  const result = await apiRequest(`/admin/offers/${id}`, { credentials: 'same-origin' });
  return result.data;
}

export async function createAdminOffer(data, csrfToken) {
  const result = await apiRequest('/admin/offers', {
    method: 'POST',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  notifyMenuChanged();
  return result.data;
}

export async function updateAdminOffer(id, data, csrfToken) {
  const result = await apiRequest(`/admin/offers/${id}`, {
    method: 'PATCH',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  notifyMenuChanged();
  return result.data;
}

export async function deleteAdminOffer(id, csrfToken) {
  const result = await apiRequest(`/admin/offers/${id}`, {
    method: 'DELETE',
    csrfToken,
    credentials: 'same-origin',
  });
  notifyMenuChanged();
  return result.data;
}
