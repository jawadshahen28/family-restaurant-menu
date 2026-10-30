import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Store, Truck, ShoppingBag, Phone, Megaphone, CheckCircle2, Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import { getAdminSettings, updateAdminSettings } from '../../../services/adminSettingsService.js';
import {
  checkPushCapabilities,
  getPushStatus,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
} from '../../../services/adminPushService.js';
import { clearMenuCache } from '../../../services/menuService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

export default function SettingsPage() {
  const { csrfToken } = useAdminAuth();

  const [restaurantName, setRestaurantName] = useState('مطعم ومطبخ العائلة');
  const [isOpen, setIsOpen] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Push Notifications state
  const [pushCapabilities, setPushCapabilities] = useState(checkPushCapabilities);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushActionLoading, setPushActionLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let active = true;

    async function checkSubscription() {
      const caps = checkPushCapabilities();
      if (!active) return;
      setPushCapabilities(caps);

      if (!caps.supported || !('serviceWorker' in navigator)) return;

      try {
        setPushLoading(true);
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager?.getSubscription();
        if (!active) return;

        const endpoint = sub ? sub.endpoint : undefined;
        const status = await getPushStatus(endpoint);
        if (!active) return;

        setIsSubscribed(Boolean(sub && status.isSubscribed));
        setDeviceCount(status.deviceCount || 0);
      } catch {
        // Silently handle status check failure on mount
      } finally {
        if (active) setPushLoading(false);
      }
    }

    checkSubscription();
    return () => {
      active = false;
    };
  }, []);

  const handleTogglePush = async () => {
    setPushMessage({ type: '', text: '' });
    setPushActionLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeCurrentDevice(csrfToken);
        setIsSubscribed(false);
        setDeviceCount((prev) => Math.max(0, prev - 1));
        setPushMessage({ type: 'success', text: 'تم إيقاف الإشعارات على هذا الجهاز.' });
      } else {
        await subscribeCurrentDevice(csrfToken);
        setIsSubscribed(true);
        setDeviceCount((prev) => prev + 1);
        setPushCapabilities(checkPushCapabilities());
        setPushMessage({ type: 'success', text: 'تم تفعيل إشعارات الطلبات الفورية بنجاح على هذا الجهاز!' });
      }
    } catch (err) {
      setPushMessage({ type: 'error', text: err.message || 'فشلت معالجة طلب الإشعارات.' });
    } finally {
      setPushActionLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        setLoading(true);
        const data = await getAdminSettings();
        if (!active) return;
        if (data) {
          setRestaurantName(data.restaurantName || 'مطعم ومطبخ العائلة');
          setIsOpen(Boolean(data.isOpen && data.acceptingOrders));
          setPickupEnabled(Boolean(data.pickupEnabled ?? true));
          setDeliveryEnabled(Boolean(data.deliveryEnabled ?? true));
          setAnnouncement(data.announcement || '');
          setPhone(data.phone || '');
        }
      } catch (err) {
        if (active) setError(err.message || 'تعذّر تحميل إعدادات المطعم.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!restaurantName.trim()) {
      setError('اسم المطعم مطلوب.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        restaurantName: restaurantName.trim(),
        isOpen,
        acceptingOrders: isOpen,
        pickupEnabled,
        deliveryEnabled,
        announcement: announcement.trim(),
        phone: phone.trim(),
      };

      const updated = await updateAdminSettings(payload, csrfToken);
      clearMenuCache();
      if (updated) {
        setRestaurantName(updated.restaurantName);
        setIsOpen(Boolean(updated.isOpen && updated.acceptingOrders));
        setPickupEnabled(Boolean(updated.pickupEnabled));
        setDeliveryEnabled(Boolean(updated.deliveryEnabled));
        setAnnouncement(updated.announcement || '');
        setPhone(updated.phone || '');
      }

      setSuccessToast('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      setError(err.message || 'فشل حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="الإعدادات"
        backTo="/admin"
      />

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل إعدادات المطعم...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Master Store Status Card */}
          <div
            className={`border rounded-2xl p-4 shadow-xs transition-all ${
              isOpen
                ? 'bg-emerald-50/50 border-emerald-200'
                : 'bg-amber-50/50 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isOpen
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Store size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#2E1E17]">
                    حالة المطعم واستقبال الطلبات
                  </h3>
                  <p className="text-xs font-semibold text-[#7D7067] mt-0.5">
                    {isOpen ? 'المطعم مفتوح ويستقبل الطلبات' : 'المطعم مغلق حاليًا'}
                  </p>
                </div>
              </div>

              <ToggleSwitch
                id="master-store-toggle"
                checked={isOpen}
                onChange={setIsOpen}
                aria-label="تبديل حالة المطعم واستقبال الطلبات"
              />
            </div>
          </div>

          {/* Fulfillment Options Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-[#482015] mb-2">طرق الاستلام المتاحة للزبائن</h3>

            {/* Pickup Switch */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <ShoppingBag size={17} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-[#2E1E17]">
                    استلام من المطعم
                  </span>
                  <span className="text-[11px] text-[#8C7D73]">
                    يستلم الزبون طلبه مباشرة من المطعم
                  </span>
                </div>
              </div>
              <ToggleSwitch
                id="pickup-toggle"
                checked={pickupEnabled}
                onChange={setPickupEnabled}
                aria-label="تفعيل الاستلام من المطعم"
              />
            </div>

            <div className="border-t border-[#F7F2EB]" />

            {/* Delivery Switch */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Truck size={17} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-[#2E1E17]">
                    خدمة التوصيل
                  </span>
                  <span className="text-[11px] text-[#8C7D73]">
                    توصيل الطلب لعنوان الزبون
                  </span>
                </div>
              </div>
              <ToggleSwitch
                id="delivery-toggle"
                checked={deliveryEnabled}
                onChange={setDeliveryEnabled}
                aria-label="تفعيل التوصيل"
              />
            </div>

            {/* Delivery Fee Notice (Preserved per guidelines) */}
            <div className="mt-2 p-2.5 bg-[#FAF6F0] border border-[#EFE8DD] rounded-xl text-[11px] text-[#8C7D73] leading-relaxed">
              📌 السعر لا يشمل رسوم التوصيل، ويتم تحديدها بالتواصل المباشر مع المطعم.
            </div>
          </div>

          {/* Restaurant Details Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-[#482015] mb-2">بيانات المطعم والتواصل</h3>

            <div>
              <label htmlFor="settings-name" className="block text-xs font-bold text-[#482015] mb-1.5">
                اسم المطعم <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="settings-name"
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="settings-phone" className="block text-xs font-bold text-[#482015] mb-1.5 flex items-center gap-1.5">
                <Phone size={14} className="text-[#8C7D73]" />
                <span>رقم هاتف المطعم</span>
              </label>
              <input
                id="settings-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0599 123 456"
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-left text-sm text-[#2E1E17] placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="settings-announcement" className="block text-xs font-bold text-[#482015] mb-1.5 flex items-center gap-1.5">
                <Megaphone size={14} className="text-[#8C7D73]" />
                <span>إعلان أو ملاحظة عامة للزبائن</span>
              </label>
              <textarea
                id="settings-announcement"
                rows={2}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="مثلاً: أوقات الدوام في رمضان من ٤ مساءً حتى ١ ليلاً..."
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          {/* Order Push Notifications Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSubscribed
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-[#DC2626]'
                  }`}
                >
                  {isSubscribed ? <BellRing size={19} /> : <Bell size={19} />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#482015]">إشعارات الطلبات الفورية</h3>
                  <p className="text-[11px] text-[#8C7D73] mt-0.5">
                    تنبيهات فورية على جهازك عند وصول أي طلب جديد من الزبائن
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  isSubscribed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isSubscribed ? 'مفعلة على هذا الجهاز' : 'معطلة على هذا الجهاز'}
              </span>
            </div>

            {deviceCount > 0 && (
              <div className="text-[11px] text-[#7D7067] flex items-center gap-1.5 pt-1">
                <Smartphone size={13} className="text-[#8C7D73]" />
                <span>إجمالي أجهزة الإدارة المسجلة لاستقبال الإشعارات: <strong>{deviceCount}</strong></span>
              </div>
            )}

            {/* iOS PWA Installation Notice */}
            {pushCapabilities.needsInstall && (
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800 space-y-1 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5">
                  <Smartphone size={15} className="shrink-0 text-amber-700" />
                  <span>تنبيه لمستخدمي iPhone و iPad:</span>
                </div>
                <p className="text-[11px] text-amber-900/90 pr-5">
                  نظام Apple يتطلب تثبيت التطبيق أولاً لتفعيل الإشعارات. اضغط على زر المشاركة في متصفح Safari ثم اختر <strong>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</strong>، وافتح التطبيق من الشاشة الرئيسية.
                </p>
              </div>
            )}

            {/* Permission Denied Notice */}
            {pushCapabilities.permission === 'denied' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>تم حظر إذن الإشعارات من إعدادات المتصفح. لتفعيلها، يرجى السماح بالإشعارات في إعدادات الموقع.</span>
              </div>
            )}

            {/* Unsupported Browser Notice */}
            {!pushCapabilities.supported && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-gray-500" />
                <span>هذا المتصفح لا يدعم تقنية الإشعارات الفورية (Web Push).</span>
              </div>
            )}

            {/* Action Feedback Messages */}
            {pushMessage.text && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  pushMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {pushMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                )}
                <span>{pushMessage.text}</span>
              </div>
            )}

            {/* Action Button */}
            {pushCapabilities.supported && (
              <div className="pt-1">
                {isSubscribed ? (
                  <button
                    type="button"
                    onClick={handleTogglePush}
                    disabled={pushActionLoading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-red-50 border border-red-300 text-red-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  >
                    {pushActionLoading ? (
                      <Loader2 size={16} className="animate-spin text-red-600" />
                    ) : (
                      <BellOff size={16} />
                    )}
                    <span>إيقاف الإشعارات على هذا الجهاز</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTogglePush}
                    disabled={pushActionLoading || pushCapabilities.needsInstall || pushCapabilities.permission === 'denied'}
                    className="w-full py-2.5 px-4 bg-[#482015] hover:bg-[#34160E] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
                  >
                    {pushActionLoading ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : (
                      <Bell size={16} />
                    )}
                    <span>تفعيل إشعارات الطلبات</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-2xl shadow-sm shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <span>حفظ التعديلات</span>
            )}
          </button>
        </form>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-20 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div className="bg-emerald-800/95 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 backdrop-blur-xs">
            <CheckCircle2 size={16} className="text-emerald-300" />
            <span>{successToast}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
