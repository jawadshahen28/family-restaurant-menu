import { ApiError } from '../utils/errors.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionId,
  generateCsrfToken,
  timingSafeCompare,
} from '../utils/auth.js';
import { ADMIN_SESSION_MAX_AGE_MS } from '../utils/cookies.js';

export function createAdminAuthService(repository, { now = Date.now } = {}) {
  return {
    /**
     * Authenticates owner credentials and creates a persistent session in MongoDB.
     */
    async login({ username, password, ip = '', userAgent = '' }) {
      const admin = await repository.findAdminByUsername(username);
      if (!admin) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      }

      const isValid = await verifyPassword(password, admin.passwordHash);
      if (!isValid) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      }

      const sessionId = generateSessionId();
      const csrfToken = generateCsrfToken();
      const expiresAt = new Date(now() + ADMIN_SESSION_MAX_AGE_MS);

      await repository.createAdminSession({
        sessionId,
        adminId: admin._id,
        csrfToken,
        expiresAt,
        ip,
        userAgent,
      });

      return {
        sessionId,
        csrfToken,
        expiresAt,
        user: {
          id: String(admin._id),
          username: admin.username,
          name: admin.name,
          role: admin.role,
        },
      };
    },

    /**
     * Verifies the session cookie and loads the associated admin user.
     */
    async verifySession(sessionId) {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ApiError(401, 'UNAUTHORIZED', 'يرجى تسجيل الدخول أولاً.');
      }

      const session = await repository.findAdminSession(sessionId);
      if (!session || !session.adminId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'جلسة الدخول غير صالحة، يرجى تسجيل الدخول مجددًا.');
      }

      const currentTime = now();
      if (new Date(session.expiresAt).getTime() <= currentTime) {
        await repository.deleteAdminSession(sessionId).catch(() => {});
        throw new ApiError(401, 'SESSION_EXPIRED', 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا.');
      }

      // Rolling extension: if session has less than 3 days remaining, extend it
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (new Date(session.expiresAt).getTime() - currentTime < threeDaysMs) {
        const newExpiry = new Date(currentTime + ADMIN_SESSION_MAX_AGE_MS);
        await repository.touchAdminSession(sessionId, newExpiry).catch(() => {});
      }

      return {
        session,
        csrfToken: session.csrfToken,
        user: {
          id: String(session.adminId._id),
          username: session.adminId.username,
          name: session.adminId.name,
          role: session.adminId.role,
        },
      };
    },

    /**
     * Validates CSRF token for state-changing requests.
     */
    verifyCsrf(expectedToken, receivedToken) {
      if (!expectedToken || !receivedToken || !timingSafeCompare(expectedToken, receivedToken)) {
        throw new ApiError(403, 'CSRF_INVALID', 'جلسة غير صالحة أو تم رفض رمز الحماية (CSRF).');
      }
    },

    /**
     * Invalidates the active session.
     */
    async logout(sessionId) {
      if (sessionId) {
        await repository.deleteAdminSession(sessionId).catch(() => {});
      }
      return { loggedOut: true };
    },
  };
}
