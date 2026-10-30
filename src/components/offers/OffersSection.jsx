import { Flame } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useMenu } from '../../context/MenuContext';
import ProductCard from '../products/ProductCard';
import ProductGrid from '../products/ProductGrid';

export function OfferCard({ offer }) {
  const { products } = useMenu();
  const product = products.find((entry) => entry.id === offer.productId && entry.isAvailable);
  return product ? <ProductCard product={product} offer={offer} large /> : null;
}

export default function OffersSection() {
  const { products } = useMenu();
  const { activeOffers } = useCart();
  const availableOffers = activeOffers.filter((offer) => products.some((product) => product.id === offer.productId && product.isAvailable));
  if (availableOffers.length) return (
    <section className="offers-section" aria-labelledby="offers-title">
      <div className="section-heading"><div><p className="section-eyebrow">لقمة أطيب، وفرحة أكبر</p><h2 id="offers-title"><Flame aria-hidden="true" />عرض اليوم</h2></div><span className="section-hint">لفترة محدودة</span></div>
      <div className="product-grid offer-grid">{availableOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
    </section>
  );
  return (
    <section className="featured-section" aria-labelledby="featured-title">
      <div className="section-heading"><div><p className="section-eyebrow">من مطبخنا… لقلوبكم</p><h2 id="featured-title">وجباتنا المميّزة</h2></div><span className="section-hint">اختار وجبتك، وصحتين!</span></div>
      <ProductGrid products={products.filter((product) => product.isFeatured && product.isAvailable)} featured />
    </section>
  );
}
