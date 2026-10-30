import { Check } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function Toast() {
  const { toast } = useCart();
  return <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-label="إشعار السلة" aria-live="polite" aria-atomic="true">{toast && <><span><Check size={18} /></span>{toast}</>}</div>;
}
