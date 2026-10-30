import { ArrowUp, ChevronLeft, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { useCart } from '../../context/CartContext';
import { formatPrice, formatItemCount } from '../../utils/format';

export default function CartButton() {
  const { count, total } = useCart();
  if (!count) return null;
  return (
    <aside className="cart-summary" aria-label="ملخص السلة">
      <Link to="/cart" className="cart-summary-action">عرض السلة<ChevronLeft size={22} /></Link>
      <div className="cart-summary-total"><span>المجموع</span><strong>{formatPrice(total)}</strong></div>
      <Link to="/cart" className="cart-summary-label"><span className="summary-cart-icon"><ShoppingCart /><span>{count}</span></span><span><strong>السلّة</strong><small>{formatItemCount(count)}</small></span></Link>
      <button className="back-to-top" type="button" aria-label="العودة إلى أعلى الصفحة" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={23} /></button>
    </aside>
  );
}
