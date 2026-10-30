import { apiRequest } from './apiClient.js';

export async function getAdminOrders({ status, page, limit } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (page) params.append('page', String(page));
  if (limit) params.append('limit', String(limit));

  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await apiRequest(`/admin/orders${query}`, { credentials: 'same-origin' });
  return result.data;
}

export async function getAdminOrder(id) {
  const result = await apiRequest(`/admin/orders/${id}`, { credentials: 'same-origin' });
  return result.data;
}

export async function updateAdminOrderStatus(id, status, csrfToken) {
  const result = await apiRequest(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: { status },
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}
