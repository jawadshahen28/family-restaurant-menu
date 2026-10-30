import { Minus, Plus } from 'lucide-react';
import { MAX_QUANTITY } from '../../utils/cart';

export default function QuantitySelector({ name, quantity, onChange, canIncrease = true }) {
  return (
    <div className="quantity-selector" dir="ltr" role="group" aria-label={`كمية ${name}`}>
      <button type="button" disabled={quantity === 0} aria-label={`تقليل كمية ${name}`} onClick={() => onChange(-1)}><Minus size={17} /></button>
      <output aria-label={`عدد ${name}`}>{quantity}</output>
      <button type="button" disabled={!canIncrease || quantity >= MAX_QUANTITY} aria-label={`زيادة كمية ${name}`} onClick={() => onChange(1)}><Plus size={17} /></button>
    </div>
  );
}
