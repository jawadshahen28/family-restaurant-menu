import { apiRequest } from './apiClient.js';

export async function getAdminCategories() {
  const result = await apiRequest('/admin/categories', { credentials: 'same-origin' });
  return result.data;
}

export async function createAdminCategory(data, csrfToken) {
  const result = await apiRequest('/admin/categories', {
    method: 'POST',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

export async function updateAdminCategory(id, data, csrfToken) {
  const result = await apiRequest(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

export async function deleteAdminCategory(id, csrfToken) {
  const result = await apiRequest(`/admin/categories/${id}`, {
    method: 'DELETE',
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

export async function getAdminProducts({ categoryId, search, available } = {}) {
  const params = new URLSearchParams();
  if (categoryId) params.append('category', categoryId);
  if (search && search.trim()) params.append('search', search.trim());
  if (available !== undefined && available !== 'all') params.append('available', String(available));

  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await apiRequest(`/admin/products${query}`, { credentials: 'same-origin' });
  return result.data;
}

export async function createAdminProduct(data, csrfToken) {
  const result = await apiRequest('/admin/products', {
    method: 'POST',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

export async function updateAdminProduct(id, data, csrfToken) {
  const result = await apiRequest(`/admin/products/${id}`, {
    method: 'PATCH',
    body: data,
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

export async function deleteAdminProduct(id, csrfToken) {
  const result = await apiRequest(`/admin/products/${id}`, {
    method: 'DELETE',
    csrfToken,
    credentials: 'same-origin',
  });
  return result.data;
}

/**
 * Converts a browser File/Blob to Base64 and uploads it securely to the admin upload endpoint.
 */
export async function uploadAdminImage(file, csrfToken) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const result = await apiRequest('/admin/upload', {
          method: 'POST',
          body: {
            data: base64Data,
            mimeType: file.type || 'image/jpeg',
            filename: file.name || 'image.jpg',
          },
          csrfToken,
          credentials: 'same-origin',
        });
        resolve(result.data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('تعذّر قراءة ملف الصورة.'));
    reader.readAsDataURL(file);
  });
}
