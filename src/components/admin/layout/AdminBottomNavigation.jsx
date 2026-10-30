import { Home, ClipboardList, UtensilsCrossed, Tag, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

export default function AdminBottomNavigation({ onUpcomingClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const navItems = [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: Home,
      path: '/admin',
      active: currentPath === '/admin',
      disabled: false,
    },
    {
      id: 'orders',
      label: 'الطلبات',
      icon: ClipboardList,
      path: '/admin/orders',
      active: currentPath.startsWith('/admin/orders'),
      disabled: false,
    },
    {
      id: 'products',
      label: 'المنتجات',
      icon: UtensilsCrossed,
      path: '/admin/products',
      active: currentPath.startsWith('/admin/products'),
      disabled: false,
    },
    {
      id: 'offers',
      label: 'العروض',
      icon: Tag,
      path: '/admin/offers',
      active: currentPath.startsWith('/admin/offers'),
      disabled: false,
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: Settings,
      path: '/admin/settings',
      active: currentPath.startsWith('/admin/settings'),
      disabled: false,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F0E6D8] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-lg"
      aria-label="التنقل الرئيسي للوحة الإدارة"
    >
      <div className="max-w-md mx-auto px-4 flex items-center justify-between" dir="rtl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.disabled && onUpcomingClick) {
                  onUpcomingClick(item.label);
                } else if (!item.disabled && item.path) {
                  navigate(item.path);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all relative cursor-pointer ${
                isActive
                  ? 'text-[#DC2626] font-bold'
                  : item.disabled
                  ? 'text-[#B0A699] hover:text-[#8C7D73] opacity-75'
                  : 'text-[#8C7D73] hover:text-[#DC2626]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={item.disabled}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className="transition-transform active:scale-90"
                />
                {isActive && (
                  <span className="absolute -top-1.5 inset-x-0 mx-auto w-1 h-1 bg-[#DC2626] rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight select-none leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
