import { useState } from 'react';
import AdminHeader from './AdminHeader.jsx';
import AdminBottomNavigation from './AdminBottomNavigation.jsx';
import AdminPageContainer from './AdminPageContainer.jsx';

export default function AdminLayout({ children }) {
  const [toastMessage, setToastMessage] = useState('');

  const handleUpcomingClick = (label) => {
    setToastMessage(`قسم «${label}» قيد التطوير وسيتم تفعيله في المرحلة القادمة.`);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2E1E17] font-sans antialiased selection:bg-red-100 selection:text-red-900" dir="rtl">
      <AdminHeader />
      <AdminPageContainer>
        {children}
      </AdminPageContainer>
      <AdminBottomNavigation onUpcomingClick={handleUpcomingClick} />

      {/* Gentle toast notification for upcoming sections */}
      {toastMessage && (
        <div className="fixed bottom-20 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div className="bg-[#2E1E17]/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg text-center backdrop-blur-xs">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
