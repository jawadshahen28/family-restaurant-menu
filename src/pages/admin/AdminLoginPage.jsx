import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import logo from '../../assets/logo.png';

export default function AdminLoginPage() {
  const { isAuthenticated, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/admin';
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError('يرجى إدخال اسم المستخدم.');
      return;
    }

    if (!password) {
      setError('يرجى إدخال كلمة المرور.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedUser, password);
      const destination = location.state?.from?.pathname || '/admin';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول. تأكد من صحة البيانات.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-between relative overflow-hidden" dir="rtl">
      {/* Main Content Area */}
      <div className="max-w-md w-full mx-auto px-6 pt-10 pb-6 flex-1 flex flex-col justify-center">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-3xl p-2.5 shadow-sm border border-[#EFE8DD] flex items-center justify-center">
            <img
              src={logo}
              alt="مطعم ومطبخ العائلة"
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl font-black text-[#2E1E17] tracking-tight">
            مطعم ومطبخ العائلة
          </h1>
          <p className="text-xs font-bold text-[#8C7D73] mt-1.5">
            تسجيل دخول الإدارة
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Error Banner */}
          {error && (
            <div
              className="p-3 bg-red-50 border border-red-200/80 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2 animate-in fade-in duration-200"
              role="alert"
            >
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Field */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
            >
              اسم المستخدم
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              dir="ltr"
              className="w-full px-4 py-3 bg-white border border-[#E8DFD3] rounded-xl text-left font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm shadow-xs"
              required
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
            >
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full pl-11 pr-4 py-3 bg-white border border-[#E8DFD3] rounded-xl text-left font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm shadow-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 cursor-pointer"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-xl shadow-md shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Decorative Food Bottom Section matching Screen 1 */}
      <div className="w-full max-w-md mx-auto px-4 pb-4 pt-2 flex items-center justify-center gap-3 opacity-30 select-none pointer-events-none">
        <div className="h-0.5 w-12 bg-[#D5C9BA] rounded-full" />
        <span className="text-[10px] font-bold text-[#8C7D73] tracking-widest uppercase">
          نظام إدارة المطعم
        </span>
        <div className="h-0.5 w-12 bg-[#D5C9BA] rounded-full" />
      </div>
    </div>
  );
}
