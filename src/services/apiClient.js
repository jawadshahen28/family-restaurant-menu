export class ApiClientError extends Error {
  constructor(code, message, { status = 0, details } = {}) { super(message); this.name = 'ApiClientError'; this.code = code; this.status = status; this.details = details; }
}

const baseURL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function apiRequest(path, { method = 'GET', body, token, csrfToken, credentials = 'omit', signal } = {}) {
  // Admin cookies belong to this origin, even when public API calls use a separate host.
  const requestBaseURL = path.startsWith('/admin/') ? '' : baseURL;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${requestBaseURL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      credentials,
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) throw new ApiClientError(payload?.error?.code || 'API_ERROR', payload?.error?.message || 'تعذّر تنفيذ الطلب حاليًا، يرجى المحاولة مرة أخرى.', { status: response.status, details: payload?.error?.details });
    return { data: payload.data, meta: payload.meta || {} };
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('NETWORK_ERROR', method === 'POST' ? 'تعذر إرسال الطلب حاليًا، يرجى المحاولة مرة أخرى. يمكنك إعادة المحاولة بأمان دون تكرار الطلب.' : 'تعذّر تحميل البيانات حاليًا. تحقق من الاتصال وحاول مجددًا.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
