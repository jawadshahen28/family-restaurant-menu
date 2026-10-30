import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import logo from '../../../assets/logo.png';

export default function AdminHeader() {
  const { logout } = useAdminAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F0E6D8] shadow-xs">
        <div className="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between" dir="rtl">
          {/* Right: Restaurant Branding */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white p-1 border border-[#EFE8DD] shadow-xs flex items-center justify-center shrink-0">
              <img src={logo} alt="مطعم ومطبخ العائلة" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-black text-[#2E1E17] leading-tight">مطعم ومطبخ العائلة</span>
              <span className="text-[11px] font-semibold text-[#8C7D73] mt-0.5">لوحة إدارة المطعم</span>
            </div>
          </div>

          {/* Left: Logout Button */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={loggingOut}
            className="w-9 h-9 rounded-xl bg-[#FFF8EE] border border-[#F4E1C4] text-[#8C7D73] hover:text-[#DC2626] hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            {loggingOut ? <Loader2 size={16} className="animate-spin text-[#DC2626]" /> : <LogOut size={16} strokeWidth={2} />}
          </button>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl border border-[#EFE8DD] text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#DC2626] mx-auto flex items-center justify-center mb-3">
              <LogOut size={22} strokeWidth={2} />
            </div>
            <h3 className="text-sm font-bold text-[#2E1E17] mb-1">تسجيل الخروج</h3>
            <p className="text-xs text-[#8C7D73] mb-4">هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة الإدارة؟</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-2 px-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {loggingOut ? 'جاري الخروج...' : 'نعم، خروج'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loggingOut}
                className="flex-1 py-2 px-3 bg-[#F5F2EB] hover:bg-[#EAE5DC] text-[#482015] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
