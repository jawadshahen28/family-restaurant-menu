import { apiRequest } from './apiClient.js';

export async function loginAdmin(username, password) {
  const result = await apiRequest('/admin/login', {
    method: 'POST',
    body: { username, password },
    credentials: 'same-origin',
  });
  return result.data;
}

export async function getAdminMe() {
  const result = await apiRequest('/admin/me', {
    credentials: 'same-origin',
  });
  return result.data;
}

export async function logoutAdmin(csrfToken) {
  const result = await apiRequest('/admin/logout', {
    method: 'POST',
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}
