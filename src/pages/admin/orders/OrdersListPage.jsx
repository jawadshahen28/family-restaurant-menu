import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ClipboardList,
  Store,
  Truck,
  Phone,
  Clock,
  ChevronLeft,
  Loader2,
  AlertCircle,
  BellRing,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import { getAdminOrders, updateAdminOrderStatus } from '../../../services/adminOrdersService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { formatCurrency, getOrderStatusInfo, formatOrderTime } from '../../../utils/format.js';

export default function OrdersListPage() {
  const navigate = useNavigate();
  const { csrfToken } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  const seenOrderIds = useRef(new Set());
  const initialLoadDone = useRef(false);
  const isMounted = useRef(true);
  const pollTimer = useRef(null);

  const filterTabs = [
    { id: 'all', label: 'الكل' },
    { id: 'new', label: 'جديد', countBadge: newCount },
    { id: 'received', label: 'تم استلام الطلب' },
    { id: 'prepared', label: 'تم التجهيز' },
  ];

  const fetchOrders = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      const data = await getAdminOrders({ status: statusFilter });
      if (!isMounted.current) return;

      const orderList = data.orders || [];
      setOrders(orderList);
      setNewCount(data.newCount || 0);
      setError('');

      // Real-time detection of genuinely new orders
      if (initialLoadDone.current) {
        const brandNewOrders = orderList.filter(
          (ord) => ord.status === 'new' && !seenOrderIds.current.has(ord.id)
        );

        if (brandNewOrders.length > 0) {
          const newest = brandNewOrders[0];
          setNewOrderAlert({
            id: newest.id,
            orderNumber: newest.orderNumber,
            customerName: newest.customer.name,
            total: newest.productsSubtotal,
          });

          // Auto-hide alert after 7 seconds
          setTimeout(() => {
            if (isMounted.current) setNewOrderAlert(null);
          }, 7000);
        }
      }

      // Mark all current order IDs as seen
      orderList.forEach((ord) => seenOrderIds.current.add(ord.id));
      initialLoadDone.current = true;
    } catch (err) {
      if (!isMounted.current) return;
      if (err.status === 401) {
        // Session expired, stop polling
        clearInterval(pollTimer.current);
        return;
      }
      if (!isPolling) {
        setError(err.message || 'تعذّر تحميل الطلبات.');
      }
    } finally {
      if (isMounted.current && !isPolling) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  // Initial and filter change effect
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Periodic polling every 7 seconds
  useEffect(() => {
    isMounted.current = true;
    pollTimer.current = setInterval(() => {
      fetchOrders(true);
    }, 7000);

    return () => {
      isMounted.current = false;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [fetchOrders]);

  // Quick status transition from the order card
  const handleQuickStatusChange = async (e, order) => {
    e.stopPropagation();
    const statusInfo = getOrderStatusInfo(order.status);
    if (!statusInfo.nextAction) return;

    setActionLoadingId(order.id);
    try {
      const updated = await updateAdminOrderStatus(order.id, statusInfo.nextAction, csrfToken);
      setOrders((prev) =>
        prev.map((ord) => (ord.id === order.id ? { ...ord, status: updated.status } : ord))
      );
      if (order.status === 'new' && updated.status !== 'new') {
        setNewCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة الطلب.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="الطلبات"
        backTo="/admin"
      />

      {/* Floating In-App Alert for New Incoming Orders */}
      {newOrderAlert && (
        <div
          onClick={() => navigate(`/admin/orders/${newOrderAlert.id}`)}
          className="fixed top-4 inset-x-4 max-w-md mx-auto z-50 bg-[#DC2626] text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between cursor-pointer animate-in slide-in-from-top-4 duration-300"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BellRing size={20} className="text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black">طلب جديد وارد!</span>
                <span className="text-[11px] opacity-90 font-mono">#{newOrderAlert.orderNumber}</span>
              </div>
              <p className="text-xs font-semibold opacity-95 mt-0.5">
                {newOrderAlert.customerName} — {formatCurrency(newOrderAlert.total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-xl transition-colors">
            <span>عرض</span>
            <ArrowRight size={14} className="rtl:rotate-180" />
          </div>
        </div>
      )}

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3.5 scrollbar-none no-scrollbar">
        {filterTabs.map((tab) => {
          const isSelected = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'bg-white text-[#482015] border border-[#EFE8DD] hover:bg-[#FAF6F0]'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.countBadge === 'number' && tab.countBadge > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white text-[#DC2626]' : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {tab.countBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل الطلبات...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchOrders(false)}
            className="text-xs font-bold underline cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#EFE8DD] p-6">
          <ClipboardList size={42} className="mx-auto text-[#D5C9BA] mb-2.5" />
          <p className="text-sm font-bold text-[#482015]">لا توجد طلبات</p>
          <p className="text-xs text-[#8C7D73] mt-1">
            {statusFilter === 'all'
              ? 'لم يتم تقديم أي طلبات حتى الآن.'
              : 'لا توجد طلبات تطابق هذه الحالة.'}
          </p>
        </div>
      )}

      {/* Orders Grid - Responsive for iPhone & iPad */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
          {orders.map((ord) => {
            const statusInfo = getOrderStatusInfo(ord.status);
            const isPickup = ord.fulfillmentType === 'pickup';
            const isActionLoading = actionLoadingId === ord.id;

            return (
              <div
                key={ord.id}
                onClick={() => navigate(`/admin/orders/${ord.id}`)}
                className="bg-white border border-[#EFE8DD] hover:border-red-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3.5 transition-all cursor-pointer group active:scale-[0.99]"
              >
                {/* Header: Order Number & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-black text-[#2E1E17] font-mono tracking-tight group-hover:text-[#DC2626] transition-colors">
                      #{ord.orderNumber}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8C7D73] mt-0.5">
                      <Clock size={12} className="text-[#B0A699]" />
                      <span>{formatOrderTime(ord.createdAt)}</span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${statusInfo.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                {/* Customer Details & Fulfillment */}
                <div className="space-y-1.5 text-right text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2E1E17] text-sm">
                      {ord.customer?.name}
                    </span>
                    <span className="font-black text-sm text-[#DC2626]">
                      {formatCurrency(ord.productsSubtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#8C7D73] text-[11px]">
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <Phone size={12} className="text-[#B0A699]" />
                      <span className="font-medium">{ord.customer?.phone}</span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold bg-[#FAF6F0] px-2 py-0.5 rounded-md border border-[#EFE8DD]">
                      {isPickup ? (
                        <>
                          <Store size={12} className="text-orange-600" />
                          <span>استلام من المطعم</span>
                        </>
                      ) : (
                        <>
                          <Truck size={12} className="text-blue-600" />
                          <span>توصيل</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Summary Preview */}
                <div className="bg-[#FAF6F0] rounded-xl p-2.5 text-xs text-[#7D7067] text-right truncate">
                  <span className="font-medium">
                    {ord.items?.map((it) => `${it.quantity}× ${it.name}`).join(' ، ')}
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F7F2EB] gap-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#8C7D73] group-hover:text-[#DC2626] transition-colors">
                    <span>عرض التفاصيل</span>
                    <ChevronLeft size={16} />
                  </div>

                  {statusInfo.nextAction && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={(e) => handleQuickStatusChange(e, ord)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60 ${
                        statusInfo.nextAction === 'received'
                          ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                      }`}
                    >
                      {isActionLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      <span>{statusInfo.nextActionLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
