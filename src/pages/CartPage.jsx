import { ArrowRight, ChevronLeft, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import Header from '../components/layout/Header';
import QuantitySelector from '../components/products/QuantitySelector';
import { useCart } from '../context/CartContext';
import { formatPrice, formatItemCount } from '../utils/format';
import EmptyCart from '../components/cart/EmptyCart';
import { useMenu } from '../context/MenuContext';
import MenuState from '../components/ui/MenuState';

export default function CartPage() {
  const { loading, error } = useMenu();
  const { items, count, total, changeQuantity, removeItem, unavailableItems } = useCart();
  return (
    <>
      <div className="masthead masthead--compact"><Header compact /></div>
      <main id="main-content" className="cart-page" tabIndex={-1}>
        <Link className="back-link" to="/"><ArrowRight size={18} />العودة لقائمة الطعام</Link>
        <div className="section-heading"><div><p className="section-eyebrow">اختياراتك الطيبة</p><h1><ShoppingBag aria-hidden="true" />سلة المشتريات</h1></div>{count > 0 && <span className="section-hint">{formatItemCount(count)}</span>}</div>
        {loading || error ? <MenuState /> : items.length === 0 ? <EmptyCart /> : <div className="cart-layout">
          <div className="cart-items">{items.map((item) => <article key={item.id} className="cart-item" data-cart-product-id={item.id}>
            <img src={item.image} alt={item.name} width="140" height="120" />
            <div className="cart-item-info"><h2>{item.name}</h2><span className="cart-unit-price">سعر القطعة: {formatPrice(item.price)}</span>{!item.isAvailable && <span className="cart-unavailable">غير متوفر حاليًا</span>}<QuantitySelector name={item.name} quantity={item.quantity} canIncrease={item.isAvailable} onChange={(delta) => changeQuantity(item.id, delta)} /></div>
            <div className="cart-item-end"><button className="remove-button" type="button" aria-label={`إزالة ${item.name} من السلة`} onClick={() => removeItem(item.id)}><Trash2 size={19} /></button><strong>{formatPrice(item.subtotal)}</strong></div>
          </article>)}</div>
          <aside className="cart-totals" aria-labelledby="cart-summary-title"><h2 id="cart-summary-title">ملخص السلّة</h2><div><span>عدد القطع</span><span>{count}</span></div><div className="cart-grand-total"><span>مجموع المنتجات</span><strong data-testid="cart-total">{formatPrice(total)}</strong></div>{unavailableItems.length > 0 ? <><p className="cart-unavailable" role="alert">احذف الأصناف غير المتوفرة حتى تكمل طلبك.</p><button className="primary-button" type="button" disabled>المتابعة لإتمام الطلب</button></> : <Link className="primary-button" to="/checkout">المتابعة لإتمام الطلب<ChevronLeft size={19} aria-hidden="true" /></Link>}<Link className="cart-continue-shopping" to="/">أضف كمان إشي طيب<ArrowRight size={16} aria-hidden="true" /></Link><p className="cart-phase-note">راجع اختياراتك ثم تابع لإرسال طلبك إلى المطعم.</p></aside>
        </div>}
      </main>
    </>
  );
}

