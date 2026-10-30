import { Navigate, useLocation } from 'react-router';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import logo from '../../../assets/logo.png';

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-[#EFE8DD] p-2 flex items-center justify-center mb-4 animate-pulse">
          <img src={logo} alt="مطعم ومطبخ العائلة" className="w-full h-full object-contain" />
        </div>
        <p className="text-sm font-bold text-[#482015] mb-1">مطعم ومطبخ العائلة</p>
        <p className="text-xs text-[#8C7D73]">جاري التحقق من الجلسة...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
