import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useMenu } from './MenuContext';
import { CART_STORAGE_KEY, MAX_QUANTITY, cartReducer, getCartItems, getCartTotals, readCart } from '../utils/cart';
import useActiveOffers from '../hooks/useActiveOffers';

const CartContext = createContext(null);

function initialCart() {
  try { return readCart(window.localStorage); } catch { return []; }
}

export function CartProvider({ children }) {
  const { products, offers, serverTimeOffset } = useMenu();
  const [cart, dispatch] = useReducer(cartReducer, undefined, initialCart);
  const [toast, setToast] = useState('');
  const timer = useRef();
  const activeOffers = useActiveOffers(offers, serverTimeOffset);
  const items = useMemo(() => {
    const missing = cart.filter((item) => !products.some((product) => product.id === item.productId)).map((item) => ({ id: item.productId, name: 'صنف غير متوفر', price: 0, image: '/images/favicon.png', isAvailable: false }));
    return getCartItems(cart, [...products, ...missing], activeOffers);
  }, [cart, products, activeOffers]);
  const { count, total } = getCartTotals(items);

  useEffect(() => {
    try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* In-memory cart still works. */ }
  }, [cart]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function announce(message) {
    window.clearTimeout(timer.current);
    setToast(message);
    timer.current = window.setTimeout(() => setToast(''), 2400);
  }
  function changeQuantity(productId, delta, notify = false) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;
    if (!product.isAvailable && delta > 0) { announce('هذا الصنف غير متوفر حاليًا. يمكنك حذفه من السلّة.'); return; }
    const quantity = cart.find((item) => item.productId === productId)?.quantity || 0;
    if (delta > 0 && quantity >= MAX_QUANTITY) { announce('وصلت للحد الأقصى: ٩٩ من كل صنف'); return; }
    dispatch({ type: 'change', productId, delta });
    if (notify) announce(`أضفنا ${product.name} لسلّتك. صحتين!`);
  }

  return (
    <CartContext.Provider value={{
      items, count, total, toast, activeOffers, cartEntries: cart,
      unavailableItems: items.filter((item) => !item.isAvailable),
      clearCart: () => dispatch({ type: 'clear' }),
      addItem: (id) => changeQuantity(id, 1, true),
      changeQuantity,
      removeItem: (productId) => dispatch({ type: 'remove', productId }),
      getQuantity: (id) => cart.find((item) => item.productId === id)?.quantity || 0,
    }}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('CartProvider is required');
  return context;
}
