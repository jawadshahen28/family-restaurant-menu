import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginAdmin, getAdminMe, logoutAdmin } from '../services/adminService.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const data = await getAdminMe();
      if (data?.authenticated && data?.user) {
        setAdmin(data.user);
        setCsrfToken(data.csrfToken);
      } else {
        setAdmin(null);
        setCsrfToken(null);
      }
    } catch {
      setAdmin(null);
      setCsrfToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const data = await loginAdmin(username, password);
    setAdmin(data.user);
    setCsrfToken(data.csrfToken);
    return data;
  };

  const logout = async () => {
    try {
      if (csrfToken) {
        await logoutAdmin(csrfToken);
      }
    } finally {
      setAdmin(null);
      setCsrfToken(null);
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
