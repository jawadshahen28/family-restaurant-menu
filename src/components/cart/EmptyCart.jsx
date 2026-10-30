import { ArrowRight, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';

export default function EmptyCart() {
  return <div className="empty-cart">
    <div className="empty-cart-icon"><ShoppingCart size={47} strokeWidth={1.4} aria-hidden="true" /></div>
    <h2>سلتك فارغة حاليًا</h2>
    <p>أضف وجباتك المفضلة من المنيو وابدأ طلبك.</p>
    <Link className="primary-button" to="/">تصفح المنيو<ArrowRight size={18} aria-hidden="true" /></Link>
  </div>;
}
