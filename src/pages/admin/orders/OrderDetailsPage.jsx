import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Store,
  Truck,
  Phone,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ReceiptText,
  User,
  MapPin,
  MessageSquare,
  Check,
} from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import { getAdminOrder, updateAdminOrderStatus } from '../../../services/adminOrdersService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { formatCurrency, getOrderStatusInfo, formatOrderTime } from '../../../utils/format.js';

export default function OrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { csrfToken } = useAdminAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccessToast, setActionSuccessToast] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getAdminOrder(id);
        if (!active) return;
        setOrder(data);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'تعذّر تحميل تفاصيل الطلب.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusChange = async (nextStatus) => {
    if (!order) return;
    setError('');
    setActionLoading(true);

    try {
      const updated = await updateAdminOrderStatus(order.id, nextStatus, csrfToken);
      setOrder(updated);

      const label = nextStatus === 'received' ? 'تم استلام الطلب' : 'تم تجهيز الطلب بنجاح';
      setActionSuccessToast(label);
      setTimeout(() => setActionSuccessToast(''), 3000);
    } catch (err) {
      setError(err.message || 'فشل تحديث حالة الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setActionLoading(false);
    }
  };

  const statusInfo = order ? getOrderStatusInfo(order.status) : null;
  const isPickup = order?.fulfillmentType === 'pickup';

  return (
    <AdminLayout>
      <AdminPageHeader
        title="تفاصيل الطلب"
        backTo="/admin/orders"
      />

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل بيانات الطلب...</p>
        </div>
      ) : !order ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#EFE8DD] p-6">
          <AlertCircle size={40} className="mx-auto text-red-500 mb-2.5" />
          <p className="text-sm font-bold text-[#482015]">الطلب غير موجود</p>
          <p className="text-xs text-[#8C7D73] mt-1">تأكد من صحة الرابط أو عد إلى قائمة الطلبات.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-12 text-right">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Order Header / Status Banner */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#8C7D73] block">رقم الطلب</span>
                <span className="text-base font-black text-[#2E1E17] font-mono tracking-tight">
                  #{order.orderNumber}
                </span>
              </div>

              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${statusInfo.badgeClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                <span>{statusInfo.label}</span>
              </span>
            </div>

            {/* Stepper Status Progress */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#F7F2EB] text-center text-xs font-bold">
              <div
                className={`p-2 rounded-xl flex items-center justify-center gap-1.5 ${
                  order.status === 'new'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span>١. جديد</span>
                {order.status !== 'new' && <Check size={13} className="text-emerald-600" />}
              </div>

              <div
                className={`p-2 rounded-xl flex items-center justify-center gap-1.5 ${
                  order.status === 'received'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : order.status === 'prepared'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-[#FAF6F0] text-[#B0A699]'
                }`}
              >
                <span>٢. تم الاستلام</span>
                {order.status === 'prepared' && <Check size={13} className="text-emerald-600" />}
              </div>

              <div
                className={`p-2 rounded-xl flex items-center justify-center gap-1.5 ${
                  order.status === 'prepared'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-[#FAF6F0] text-[#B0A699]'
                }`}
              >
                <span>٣. تم التجهيز</span>
                {order.status === 'prepared' && <Check size={13} className="text-emerald-600" />}
              </div>
            </div>
          </div>

          {/* Customer & Fulfillment Information Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#482015] flex items-center gap-1.5 mb-2">
              <User size={15} className="text-[#DC2626]" />
              <span>بيانات الزبون والاستلام</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EFE8DD]">
                <span className="text-[#8C7D73] block text-[11px] mb-0.5">اسم الزبون</span>
                <span className="text-sm font-bold text-[#2E1E17]">{order.customer?.name}</span>
              </div>

              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EFE8DD]">
                <span className="text-[#8C7D73] block text-[11px] mb-0.5">رقم الهاتف</span>
                <a
                  href={`tel:${order.customer?.phone}`}
                  dir="ltr"
                  className="text-sm font-bold text-[#DC2626] hover:underline inline-flex items-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>{order.customer?.phone}</span>
                </a>
              </div>

              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EFE8DD]">
                <span className="text-[#8C7D73] block text-[11px] mb-0.5">طريقة الاستلام</span>
                <span className="text-sm font-bold text-[#2E1E17] flex items-center gap-1.5">
                  {isPickup ? (
                    <>
                      <Store size={14} className="text-orange-600" />
                      <span>استلام من المطعم</span>
                    </>
                  ) : (
                    <>
                      <Truck size={14} className="text-blue-600" />
                      <span>خدمة التوصيل</span>
                    </>
                  )}
                </span>
              </div>

              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EFE8DD]">
                <span className="text-[#8C7D73] block text-[11px] mb-0.5">تاريخ ووقت الطلب</span>
                <span className="text-xs font-bold text-[#2E1E17] flex items-center gap-1.5">
                  <Clock size={13} className="text-[#8C7D73]" />
                  <span>{formatOrderTime(order.createdAt)}</span>
                </span>
              </div>
            </div>

            {/* Delivery Address (only if delivery) */}
            {!isPickup && order.deliveryAddress && (
              <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1">
                  <MapPin size={14} className="text-blue-600" />
                  <span>عنوان التوصيل:</span>
                </div>
                <p className="text-blue-950 font-medium leading-relaxed">
                  {order.deliveryAddress}
                </p>
              </div>
            )}

            {/* Customer Notes (if provided) */}
            {order.notes && (
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <MessageSquare size={14} className="text-amber-600" />
                  <span>ملاحظات الزبون:</span>
                </div>
                <p className="text-amber-950 font-medium leading-relaxed">
                  {order.notes}
                </p>
              </div>
            )}
          </div>

          {/* Order Items & Pricing Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#482015] flex items-center gap-1.5 mb-3">
              <ReceiptText size={15} className="text-[#DC2626]" />
              <span>الوجبات والأصناف المطلوبة</span>
            </h3>

            <div className="divide-y divide-[#F7F2EB]">
              {order.items?.map((item, index) => (
                <div key={index} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#FAF6F0] border border-[#EFE8DD] font-bold text-[#DC2626] flex items-center justify-center shrink-0">
                      {item.quantity}
                    </span>
                    <span className="font-bold text-[#2E1E17] text-sm">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#8C7D73]">
                      ({formatCurrency(item.unitPrice)})
                    </span>
                    <span className="font-bold text-[#2E1E17] min-w-14 text-left">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className="mt-3 pt-3 border-t border-[#EFE8DD] flex items-center justify-between">
              <span className="text-sm font-black text-[#482015]">المجموع الكلي للوجبات:</span>
              <span className="text-base font-black text-[#DC2626]">
                {formatCurrency(order.productsSubtotal)}
              </span>
            </div>

            {!isPickup && (
              <p className="text-[11px] text-[#8C7D73] mt-2 text-center">
                * السعر لا يشمل رسوم التوصيل، ويتم تحديدها بالتواصل المباشر مع المطعم.
              </p>
            )}
          </div>

          {/* Primary Action Button Based on Flow: new -> received -> prepared */}
          <div className="pt-2">
            {order.status === 'new' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('received')}
                className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm rounded-2xl shadow-sm shadow-blue-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>تم استلام الطلب</span>
                  </>
                )}
              </button>
            )}

            {order.status === 'received' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('prepared')}
                className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-2xl shadow-sm shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>تم التجهيز</span>
                  </>
                )}
              </button>
            )}

            {order.status === 'prepared' && (
              <div className="w-full py-3.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm rounded-2xl flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>تم تجهيز هذا الطلب بالكامل</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Success Toast */}
      {actionSuccessToast && (
        <div className="fixed bottom-20 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div className="bg-emerald-800/95 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 backdrop-blur-xs">
            <CheckCircle2 size={16} className="text-emerald-300" />
            <span>{actionSuccessToast}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
