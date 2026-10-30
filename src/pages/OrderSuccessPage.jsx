import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowRight, Check, FileQuestion, LoaderCircle, ReceiptText } from 'lucide-react';
import Header from '../components/layout/Header';
import OrderNotice from '../components/checkout/OrderNotice';
import OrderSummary from '../components/checkout/OrderSummary';
import { loadOrder } from '../services/orderService';

const statusLabels = {
  new: 'جديد',
  received: 'تم استلام الطلب',
  prepared: 'تم التجهيز',
  confirmed: 'جديد',
  preparing: 'تم استلام الطلب',
  ready: 'تم التجهيز',
  completed: 'تم التجهيز',
};
export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('token');
  const [result, setResult] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ loading: true });
    loadOrder(orderId, token, { signal: controller.signal }).then((order) => setResult({ order, loading: false })).catch((error) => { if (error.name !== 'AbortError') setResult({ error: error.message, loading: false }); });
    return () => controller.abort();
  }, [orderId, token, retry]);
  const { order } = result;
  return <>
    <div className="masthead masthead--compact"><Header compact /></div>
    <main id="main-content" className="flow-page order-success-page" tabIndex={-1}>
      <Link className="back-link" to="/"><ArrowRight size={18} aria-hidden="true" />العودة إلى المنيو</Link>
      {result.loading ? <div className="api-menu-state" role="status"><LoaderCircle className="checkout-spinner" aria-hidden="true" /><p>جارٍ تحميل تفاصيل طلبك…</p></div> : !order ? <div className="missing-order"><span><FileQuestion size={43} aria-hidden="true" /></span><h1>{result.error ? 'تعذّر عرض الطلب' : 'الطلب غير موجود'}</h1><p>{result.error || 'قد يكون الرابط غير صحيح، أو يفتقد رمز الوصول الخاص بهذا الطلب.'}</p>{result.error && <button className="primary-button" type="button" onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</button>}<Link className="primary-button" to="/">تصفح المنيو<ArrowRight size={18} aria-hidden="true" /></Link></div> : <>
        <div className="confirmation-hero"><span className="confirmation-check"><Check size={39} strokeWidth={2.4} aria-hidden="true" /></span><p>صحتين وعافية!</p><h1>تم تأكيد طلبك بنجاح!</h1><span className="confirmation-status">{statusLabels[order.status] || 'جديد'}</span></div>
        <OrderNotice confirmed />
        <div className="confirmation-layout">
          <section className="confirmation-details" aria-labelledby="order-details-title"><h2 id="order-details-title"><ReceiptText size={22} aria-hidden="true" />تفاصيل الطلب</h2><dl>
            <div className="confirmation-reference"><dt>رقم الطلب</dt><dd><bdi data-testid="order-reference">{order.orderNumber}</bdi></dd></div>
            <div><dt>الاسم</dt><dd>{order.customer.name}</dd></div>
            <div><dt>رقم الهاتف</dt><dd><bdi>{order.customer.phone}</bdi></dd></div>
            <div><dt>طريقة الاستلام</dt><dd>{order.fulfillmentType === 'delivery' ? 'توصيل' : 'استلام من المطعم'}</dd></div>
            {order.fulfillmentType === 'delivery' && <div className="confirmation-wide"><dt>عنوان التوصيل</dt><dd>{order.deliveryAddress}</dd></div>}
            {order.notes && <div className="confirmation-wide"><dt>ملاحظاتك</dt><dd>{order.notes}</dd></div>}
            <div className="confirmation-wide"><dt>وقت الطلب</dt><dd>{new Intl.DateTimeFormat('ar-PS', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(order.createdAt))}</dd></div>
          </dl><Link className="primary-button" to="/">العودة إلى المنيو<ArrowRight size={18} aria-hidden="true" /></Link></section>
          <OrderSummary items={order.items} productsSubtotal={order.productsSubtotal} fulfillmentType={order.fulfillmentType} />
        </div>
      </>}
    </main>
  </>;
}
