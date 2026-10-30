import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Plus, MoreVertical, Loader2, Tag, AlertCircle, Calendar } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import { getAdminOffers, updateAdminOffer } from '../../../services/adminOffersService.js';
import { clearMenuCache } from '../../../services/menuService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { formatCurrency, getOfferStatus, formatDate } from '../../../utils/format.js';

export default function OffersListPage() {
  const navigate = useNavigate();
  const { csrfToken } = useAdminAuth();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminOffers();
      setOffers(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'تعذّر تحميل العروض.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleToggleActive = async (offer, newStatus) => {
    setTogglingId(offer.id);
    try {
      const updated = await updateAdminOffer(offer.id, { isActive: newStatus }, csrfToken);
      clearMenuCache();
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, isActive: updated.isActive } : o))
      );
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة العرض.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="العروض"
        backTo="/admin"
      />

      {/* Prominent Red Button matching Approved Design */}
      <button
        type="button"
        onClick={() => navigate('/admin/offers/new')}
        className="w-full py-3.5 px-4 mb-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-2xl shadow-sm shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span>+ إضافة عرض جديد</span>
      </button>

      {/* Loading State */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل العروض...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2.5 mb-4">
          <AlertCircle size={18} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && offers.length === 0 && (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#EFE8DD] p-6">
          <Tag size={40} className="mx-auto text-[#D5C9BA] mb-2.5" />
          <p className="text-sm font-bold text-[#482015]">لا توجد عروض حاليًا</p>
          <p className="text-xs text-[#8C7D73] mt-1">أضف عروضًا ترويجية لوجباتك المميّزة لجذب الزبائن.</p>
        </div>
      )}

      {/* Offers Grid - Responsive for iPhone & iPad */}
      {!loading && offers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {offers.map((offer) => {
            const status = getOfferStatus(offer);
            const offerImg = offer.image || offer.productId?.image;

            return (
              <div
                key={offer.id}
                className="bg-white border border-[#EFE8DD] hover:border-red-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between gap-3 transition-all"
              >
                {/* Top Section: Image & Details */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD3] shrink-0">
                      {offerImg ? (
                        <img
                          src={offerImg}
                          alt={offer.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🏷️
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col text-right truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[#2E1E17] truncate">
                          {offer.title}
                        </span>
                      </div>

                      {offer.productId?.name && (
                        <span className="text-xs font-semibold text-[#8C7D73] mt-0.5 truncate">
                          الوجبة: {offer.productId.name}
                        </span>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-black text-[#DC2626]">
                          {formatCurrency(offer.offerPrice)}
                        </span>
                        {offer.originalPrice > offer.offerPrice && (
                          <span className="text-xs font-semibold text-gray-400 line-through">
                            {formatCurrency(offer.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${status.badgeClass}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Bottom Bar: Dates, Toggle, & Edit Action */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F7F2EB] text-xs text-[#8C7D73]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium truncate">
                    <Calendar size={13} className="shrink-0 text-[#B0A699]" />
                    <span className="truncate">
                      ينتهي: {formatDate(offer.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ToggleSwitch
                      id={`offer-toggle-${offer.id}`}
                      checked={offer.isActive}
                      onChange={(val) => handleToggleActive(offer, val)}
                      disabled={togglingId === offer.id}
                      aria-label={`تفعيل عرض ${offer.title}`}
                    />

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/offers/${offer.id}/edit`)}
                      className="text-[#B0A699] hover:text-[#DC2626] p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      aria-label={`تعديل عرض ${offer.title}`}
                      title="تعديل العرض"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
