import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, ChevronLeft, ClipboardList, LoaderCircle, LockKeyhole, Store, Truck } from 'lucide-react';
import Header from '../components/layout/Header';
import EmptyCart from '../components/cart/EmptyCart';
import OrderSummary from '../components/checkout/OrderSummary';
import { useCart } from '../context/CartContext';
import { validateCheckout } from '../utils/checkoutValidation';
import { submitOrder } from '../services/orderService';
import { createUUID } from '../utils/identifiers';
import { useMenu } from '../context/MenuContext';
import MenuState from '../components/ui/MenuState';

const initialValues = { name: '', phone: '', fulfillmentType: 'pickup', deliveryAddress: '', notes: '' };

export default function CheckoutPage() {
  const { loading, error: menuError, store, refreshMenu } = useMenu();
  const { items, total, count, cartEntries, unavailableItems, clearCart } = useCart();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const submissionKey = useRef(createUUID());
  const cartRef = useRef(cartEntries);
  const controller = useRef();
  const errorSummary = useRef();
  const formRef = useRef();
  const navigate = useNavigate();
  const orderingAvailable = !!store?.isOpen && store.acceptingOrders;
  const methodEnabled = !!store?.[`${values.fulfillmentType}Enabled`];
  cartRef.current = cartEntries;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (submitError) errorSummary.current?.focus(); }, [submitError]);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      if (name === 'fulfillmentType') delete next.deliveryAddress;
      return next;
    });
    setSubmitError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = validateCheckout(values);
    setErrors(validation.errors);
    setSubmitError('');
    if (Object.keys(validation.errors).length) {
      const firstField = Object.keys(validation.errors)[0];
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstField)?.focus());
      return;
    }
    if (!orderingAvailable || !methodEnabled) { setSubmitError(!store?.isOpen ? 'المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.' : 'طريقة الاستلام المختارة أو استقبال الطلبات غير متاح حاليًا.'); return; }
    if (!count || unavailableItems.length) {
      setSubmitError(unavailableItems.length ? 'أحد الأصناف غير متوفر حاليًا. راجع السلّة واحذفه حتى تكمل طلبك.' : 'سلّتك فارغة. أضف وجباتك المفضلة أولًا.');
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    controller.current = new AbortController();
    try {
      const order = await submitOrder({ checkout: values, items, submissionKey: submissionKey.current, expectedProductsSubtotal: total }, { signal: controller.current.signal });
      if (JSON.stringify(cartRef.current) === JSON.stringify(cartEntries)) clearCart();
      navigate(`/order-success/${order.id}#token=${order.confirmationToken}`, { replace: true });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSubmitError(error.message || 'تعذر إرسال الطلب حاليًا، يرجى المحاولة مرة أخرى.');
      if (error.fields) setErrors(error.fields);
      if (error.code === 'IDEMPOTENCY_CONFLICT') submissionKey.current = createUUID();
      if (['PRICE_CHANGED', 'UNAVAILABLE_PRODUCT', 'OFFER_UNAVAILABLE', 'STORE_CLOSED', 'ORDERS_PAUSED', 'FULFILLMENT_DISABLED'].includes(error.code)) await refreshMenu();
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  function errorFor(field) {
    return errors[field] ? <span className="checkout-field-error" id={`error-${field}`}>{errors[field]}</span> : null;
  }

  return <>
    <div className="masthead masthead--compact"><Header compact /></div>
    <main id="main-content" className="flow-page checkout-page" tabIndex={-1}>
      <Link className="back-link" to="/cart"><ArrowRight size={18} aria-hidden="true" />العودة إلى السلة</Link>
      <div className="section-heading"><div><p className="section-eyebrow">خطوة صغيرة… وطلبك جاهز للمراجعة</p><h1><ClipboardList aria-hidden="true" />إتمام الطلب</h1></div></div>
      {loading || menuError ? <MenuState /> : !items.length ? <EmptyCart /> : <>
        <ol className="checkout-progress" aria-label="خطوات الطلب"><li><Check size={15} aria-hidden="true" />السلة</li><li aria-current="step"><span>٢</span>بيانات الطلب</li><li><span>٣</span>التأكيد</li></ol>
        {!orderingAvailable && <p className="store-availability-notice" role="alert">{!store?.isOpen ? 'المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.' : 'استقبال الطلبات متوقف حاليًا. يمكنك تصفح المنيو والمحاولة لاحقًا.'}</p>}
          <form ref={formRef} className="checkout-layout checkout-form" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <fieldset disabled={isSubmitting} className="checkout-form-fields">
              <fieldset className="fulfillment-fieldset"><legend>كيف بتحب تستلم طلبك؟</legend><div className="fulfillment-options">
                {[{ value: 'pickup', label: 'استلام من المطعم', description: 'استلم طلبك بنفسك', Icon: Store }, { value: 'delivery', label: 'توصيل', description: 'على العنوان اللي بتحدده', Icon: Truck }].map(({ value, label, description, Icon }) => <label key={value} className={`fulfillment-option ${values.fulfillmentType === value ? 'is-active' : ''}`}>
                  <input type="radio" name="fulfillmentType" value={value} checked={values.fulfillmentType === value} disabled={!store?.[`${value}Enabled`]} onChange={updateField} /><Icon size={25} aria-hidden="true" /><strong>{label}</strong><small>{description}</small><span className="fulfillment-check" aria-hidden="true">{values.fulfillmentType === value && <Check size={12} />}</span>
                </label>)}
              </div>{errorFor('fulfillmentType')}</fieldset>
              <div className="checkout-form-divider" />
              <div className="checkout-fields-heading"><h2>بياناتك</h2><span>بدون حساب، بكل بساطة</span></div>
              <div className="checkout-field"><label htmlFor="customer-name">الاسم <span aria-hidden="true">*</span></label><input id="customer-name" name="name" type="text" autoComplete="name" maxLength={120} value={values.name} onChange={updateField} placeholder="اسمك الكريم" required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} />{errorFor('name')}</div>
              <div className="checkout-field"><label htmlFor="customer-phone">رقم الهاتف <span aria-hidden="true">*</span></label><input id="customer-phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={32} value={values.phone} onChange={updateField} placeholder="0599 123 456" required aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-hint error-phone' : 'phone-hint'} /><span className="checkout-field-hint" id="phone-hint">رقم محلي، أو مع المقدمة الدولية ‎+970 أو ‎+972.</span>{errorFor('phone')}</div>
              {values.fulfillmentType === 'delivery' && <div className="checkout-field"><label htmlFor="delivery-address">عنوان التوصيل <span aria-hidden="true">*</span></label><textarea id="delivery-address" name="deliveryAddress" autoComplete="street-address" rows={3} maxLength={1000} value={values.deliveryAddress} onChange={updateField} placeholder="المنطقة، الشارع، وأقرب معلم معروف" required aria-invalid={!!errors.deliveryAddress} aria-describedby={errors.deliveryAddress ? 'error-deliveryAddress' : undefined} />{errorFor('deliveryAddress')}</div>}
              <div className="checkout-field"><label htmlFor="order-notes">ملاحظات إضافية (اختياري)</label><textarea id="order-notes" name="notes" rows={2} maxLength={1000} value={values.notes} onChange={updateField} placeholder="مثلاً: بدون مخلل، الصوص على جنب..." aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'error-notes' : undefined} />{errorFor('notes')}</div>
            </fieldset>
            <aside className="checkout-summary-column"><OrderSummary items={items} productsSubtotal={total} fulfillmentType={values.fulfillmentType} /></aside>
            <div className="checkout-confirm-panel">
              {unavailableItems.length > 0 && <p className="checkout-submit-error" role="alert">أحد الأصناف غير متوفر حاليًا. <Link to="/cart">ارجع إلى السلة</Link> واحذفه حتى تكمل طلبك.</p>}
              {submitError && <div ref={errorSummary} className="checkout-submit-error" role="alert" tabIndex={-1}>{submitError}</div>}
              {!methodEnabled && <p className="checkout-submit-error" role="alert">طريقة الاستلام المختارة غير متاحة حاليًا. اختر الطريقة الأخرى إذا كانت متاحة.</p>}
              <div className="checkout-submit"><button className="primary-button" type="submit" disabled={isSubmitting || unavailableItems.length > 0 || !orderingAvailable || !methodEnabled}>{isSubmitting ? <><LoaderCircle className="checkout-spinner" size={20} aria-hidden="true" />جارٍ إرسال طلبك…</> : <>تأكيد الطلب<ChevronLeft size={20} aria-hidden="true" /></>}</button><p><LockKeyhole size={13} aria-hidden="true" />تأكيد مباشر للطلب، بدون دفع إلكتروني</p></div>
            </div>
          </form>
      </>}
    </main>
  </>;
}
