import { apiRequest } from './apiClient.js';

export async function getAdminSettings() {
  const result = await apiRequest('/admin/settings', { credentials: 'same-origin' });
  return result.data;
}

export async function updateAdminSettings(data, csrfToken) {
  const result = await apiRequest('/admin/settings', {
    method: 'PATCH',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}
