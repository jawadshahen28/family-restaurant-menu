import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loginAdmin, getAdminMe, logoutAdmin } from '../services/adminService.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const authVersion = useRef(0);

  const checkAuth = useCallback(async () => {
    const version = ++authVersion.current;
    try {
      const data = await getAdminMe();
      if (version !== authVersion.current) return;
      if (data?.authenticated && data?.user) {
        setAdmin(data.user);
        setCsrfToken(data.csrfToken);
      } else {
        setAdmin(null);
        setCsrfToken(null);
      }
    } catch {
      if (version === authVersion.current) {
        setAdmin(null);
        setCsrfToken(null);
      }
    } finally {
      if (version === authVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const version = ++authVersion.current;
    try {
      await loginAdmin(username, password);
      // A successful POST alone does not prove the browser retained the HttpOnly cookie.
      const data = await getAdminMe();
      if (!data?.authenticated || !data.user || !data.csrfToken) {
        throw new Error('تعذّر التحقق من جلسة تسجيل الدخول. أعد المحاولة.');
      }
      if (version === authVersion.current) {
        setAdmin(data.user);
        setCsrfToken(data.csrfToken);
      }
      return data;
    } catch (error) {
      if (version === authVersion.current) {
        setAdmin(null);
        setCsrfToken(null);
      }
      throw error;
    } finally {
      if (version === authVersion.current) setIsLoading(false);
    }
  };

  const logout = async () => {
    const version = ++authVersion.current;
    try {
      if (csrfToken) {
        await logoutAdmin(csrfToken);
      }
    } finally {
      if (version === authVersion.current) {
        setAdmin(null);
        setCsrfToken(null);
        setIsLoading(false);
      }
    }
  };

  const value = {
    admin,
    csrfToken,
    isAuthenticated: !!admin,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
