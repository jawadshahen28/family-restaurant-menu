import { Flame, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/format';
import QuantitySelector from './QuantitySelector';

export default function ProductCard({ product, large = false, offer }) {
  const { addItem, changeQuantity, getQuantity, activeOffers } = useCart();
  const effectiveOffer = offer || activeOffers.find((entry) => entry.productId === product.id);
  const price = effectiveOffer ? Math.min(product.price, effectiveOffer.offerPrice) : product.price;
  return (
    <article className={`product-card ${large ? 'product-card--large' : ''}`} data-product-id={product.id}>
      <div className="product-photo">
        <img src={effectiveOffer?.image || product.image} alt={product.name} width="440" height="280" loading="lazy" />
        {(effectiveOffer || product.badge) && <span className={`product-badge ${effectiveOffer ? 'product-badge--offer' : ''}`}>{effectiveOffer ? 'عرض خاص' : product.badge}</span>}
        {product.isSpicy && <span className="spicy-badge" aria-label="حار"><Flame size={17} /></span>}
      </div>
      <div className="product-body">
        <h3>{effectiveOffer?.title || product.name}</h3>
        <p>{effectiveOffer?.description || product.description}</p>
        <div className="product-price">{effectiveOffer && <del>{formatPrice(effectiveOffer.originalPrice)}</del>}<span>{formatPrice(price)}</span></div>
        <div className="product-actions">
          <button className="add-button" type="button" onClick={() => addItem(product.id)} disabled={!product.isAvailable} aria-label={`إضافة ${product.name} للسلة`}><ShoppingCart size={19} /><span>إضافة</span></button>
          <QuantitySelector name={product.name} quantity={getQuantity(product.id)} onChange={(delta) => changeQuantity(product.id, delta)} />
        </div>
      </div>
    </article>
  );
}
