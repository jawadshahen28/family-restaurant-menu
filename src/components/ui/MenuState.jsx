import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useMenu } from '../../context/MenuContext';
export default function MenuState() {
  const { loading, error, refreshMenu } = useMenu();
  return <div className="api-menu-state" role={error ? 'alert' : 'status'}>{loading ? <><LoaderCircle size={24} className="checkout-spinner" aria-hidden="true" /><p>جارٍ تحميل قائمة الطعام…</p></> : <><p>{error}</p><button className="primary-button" type="button" onClick={refreshMenu}><RefreshCw size={17} aria-hidden="true" />إعادة المحاولة</button></>}</div>;
}
