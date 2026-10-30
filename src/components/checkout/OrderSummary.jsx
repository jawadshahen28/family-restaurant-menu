import { ShoppingBag, Store, Truck } from 'lucide-react';
import { formatPrice } from '../../utils/format';

export const DELIVERY_NOTICE = 'السعر لا يشمل رسوم التوصيل، ويتم تحديدها بالتواصل مع المطعم.';

export default function OrderSummary({ items, productsSubtotal, fulfillmentType, title = 'ملخص طلبك' }) {
  const isDelivery = fulfillmentType === 'delivery';
  const FulfillmentIcon = isDelivery ? Truck : Store;
  return <section className="order-summary" aria-label={title}>
    <h2><ShoppingBag size={21} aria-hidden="true" />{title}</h2>
    <ul className="order-summary-items">
      {items.map((item) => <li key={item.productId || item.id}>
        {item.image && <img src={item.image} alt="" width="48" height="48" />}
        <div><strong>{item.name}</strong><span>{item.quantity} × <bdi>{formatPrice(item.unitPrice ?? item.price)}</bdi></span></div>
        <bdi className="order-line-total">{formatPrice(item.lineTotal ?? item.subtotal)}</bdi>
      </li>)}
    </ul>
    <div className="order-summary-method"><span>طريقة الاستلام</span><strong><FulfillmentIcon size={17} aria-hidden="true" />{isDelivery ? 'توصيل' : 'استلام من المطعم'}</strong></div>
    <div className="order-summary-subtotal"><span>مجموع المنتجات</span><bdi>{formatPrice(productsSubtotal)}</bdi></div>
    <div className="order-summary-total"><span>{isDelivery ? 'الإجمالي بدون التوصيل' : 'الإجمالي'}</span><strong data-testid="order-total"><bdi>{formatPrice(productsSubtotal)}</bdi></strong></div>
    {isDelivery && <p className="delivery-fee-notice"><Truck size={18} aria-hidden="true" />{DELIVERY_NOTICE}</p>}
  </section>;
}
