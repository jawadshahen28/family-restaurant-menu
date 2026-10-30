import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMenu } from '../services/menuService';
const MenuContext = createContext(null);

export function MenuProvider({ children }) {
  const [state, setState] = useState({ categories: [], products: [], offers: [], store: null, serverTimeOffset: 0, loading: true, error: '' });
  const refreshMenu = useCallback(async () => {
    try { const menu = await getMenu({ force: true }); setState({ ...menu, loading: false, error: '' }); return menu; }
    catch (error) { setState((previous) => ({ ...previous, loading: false, error: error.message })); return null; }
  }, []);
  useEffect(() => {
    let active = true;
    getMenu().then((menu) => { if (active) setState({ ...menu, loading: false, error: '' }); }).catch((error) => { if (active) setState((previous) => ({ ...previous, loading: false, error: error.message })); });
    const refresh = () => { if (document.visibilityState === 'visible') refreshMenu(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshMenu]);
  return <MenuContext.Provider value={{ ...state, refreshMenu }}>{children}</MenuContext.Provider>;
}
export function useMenu() { const value = useContext(MenuContext); if (!value) throw new Error('MenuProvider is required'); return value; }
