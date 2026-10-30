/**
 * Safely parses cookie strings from HTTP request headers.
 */
export function parseCookies(cookieHeader = '') {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Sets the httpOnly, sameSite session cookie for the authenticated admin.
 */
export function setSessionCookie(res, sessionId, { secure = false, maxAge = ADMIN_SESSION_MAX_AGE_MS } = {}) {
  res.cookie(ADMIN_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

/**
 * Clears the admin session cookie.
 */
export function clearSessionCookie(res, { secure = false } = {}) {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}
