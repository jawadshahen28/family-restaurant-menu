import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  LayoutGrid,
  UtensilsCrossed,
  Tag,
  ClipboardList,
  Settings,
  ChevronLeft,
} from 'lucide-react';
import AdminLayout from '../../components/admin/layout/AdminLayout.jsx';
import { getAdminOrders } from '../../services/adminOrdersService.js';

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState('');
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminOrders({ status: 'new', limit: 1 })
      .then((data) => {
        if (active && data?.newCount) setNewOrdersCount(data.newCount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleCardClick = (card) => {
    if (card.path) {
      navigate(card.path);
      return;
    }
    setToastMessage(`قسم «${card.title}» قيد التطوير وسيتم تفعيله في المراحل القادمة.`);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  const cards = [
    {
      id: 'categories',
      title: 'الفئات',
      subtitle: 'إدارة التصنيفات',
      icon: LayoutGrid,
      path: '/admin/categories',
    },
    {
      id: 'products',
      title: 'المنتجات',
      subtitle: 'إدارة الأصناف',
      icon: UtensilsCrossed,
      path: '/admin/products',
    },
    {
      id: 'offers',
      title: 'العروض',
      subtitle: 'إدارة العروض',
      icon: Tag,
      path: '/admin/offers',
    },
    {
      id: 'orders',
      title: 'الطلبات',
      subtitle: 'إدارة الطلبات',
      icon: ClipboardList,
      path: '/admin/orders',
      badge: newOrdersCount > 0 ? `${newOrdersCount}` : null,
    },
  ];

  return (
    <AdminLayout>
      {/* Welcome Banner Card matching Screen 2 */}
      <section
        className="w-full bg-[#FFF8EE] border border-[#F4E1C4] rounded-2xl p-4 shadow-xs text-right relative overflow-hidden"
        aria-label="رسالة الترحيب"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-black text-[#482015] flex items-center gap-1.5">
              <span>مرحبًا بك</span>
              <span className="text-lg">👋</span>
            </h2>
            <p className="text-xs font-semibold text-[#7D7067] mt-1 leading-relaxed">
              يمكنك إدارة المنيو والمنتجات بسهولة.
            </p>
          </div>
        </div>
      </section>

      {/* Main 2-Column Grid of Navigation Cards */}
      <section
        className="grid grid-cols-2 gap-3 mt-4"
        aria-label="أقسام الإدارة"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card)}
              className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs flex flex-col items-center justify-center text-center hover:border-red-200 hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer group relative"
            >
              {card.badge && (
                <span className="absolute top-2.5 left-2.5 bg-[#DC2626] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                  {card.badge} جديد
                </span>
              )}
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC2626] flex items-center justify-center mb-2.5 group-hover:bg-red-100/70 transition-colors">
                <Icon size={24} strokeWidth={2} />
              </div>
              <span className="text-sm font-bold text-[#2E1E17] group-hover:text-[#DC2626] transition-colors">
                {card.title}
              </span>
              <span className="text-[11px] font-semibold text-[#8C7D73] mt-0.5">
                {card.subtitle}
              </span>
            </button>
          );
        })}
      </section>

      {/* Full-Width Settings Card matching Screen 2 */}
      <section className="mt-3">
        <button
          type="button"
          onClick={() => handleCardClick({ title: 'الإعدادات', path: '/admin/settings' })}
          className="w-full bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-red-200 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer group text-right"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#DC2626] flex items-center justify-center group-hover:bg-red-100/70 transition-colors shrink-0">
              <Settings size={22} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#2E1E17] group-hover:text-[#DC2626] transition-colors">
                الإعدادات
              </span>
              <span className="text-[11px] font-semibold text-[#8C7D73] mt-0.5">
                إعدادات المطعم
              </span>
            </div>
          </div>
          <div className="text-[#B0A699] group-hover:text-[#DC2626] transition-colors pl-1">
            <ChevronLeft size={18} strokeWidth={2} />
          </div>
        </button>
      </section>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="fixed bottom-20 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div className="bg-[#2E1E17]/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg text-center backdrop-blur-xs">
            {toastMessage}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
