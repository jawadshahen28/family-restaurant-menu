import { Info } from 'lucide-react';

export default function OrderNotice({ confirmed = false }) {
  return <div className="order-notice" role="note">
    <Info size={21} aria-hidden="true" />
    <div><strong>{confirmed ? 'طلبك مؤكد' : 'تأكيد مباشر للطلب'}</strong><p>{confirmed ? 'احتفظ برابط هذه الصفحة لمراجعة تفاصيل طلبك وحالته.' : 'راجع بياناتك واختياراتك قبل الإرسال. لا يلزم تسجيل حساب.'}</p></div>
  </div>;
}
