import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Plus, MoreVertical, Loader2, UtensilsCrossed, AlertCircle, Edit3 } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import { getAdminCategories, updateAdminCategory } from '../../../services/adminCatalogService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

export default function CategoriesListPage() {
  const navigate = useNavigate();
  const { csrfToken } = useAdminAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getAdminCategories();
      setCategories(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'تعذّر تحميل الفئات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleToggleActive = async (category, newStatus) => {
    setTogglingId(category.id);
    try {
      const updated = await updateAdminCategory(category.id, { isActive: newStatus }, csrfToken);
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, isActive: updated.isActive } : c))
      );
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة الفئة.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="الفئات"
        backTo="/admin"
      />

      {/* Prominent Red Button matching Screen 3 */}
      <button
        type="button"
        onClick={() => navigate('/admin/categories/new')}
        className="w-full py-3.5 px-4 mb-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-2xl shadow-sm shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span>إضافة فئة جديدة</span>
      </button>

      {/* Loading State */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل الفئات...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2.5 mb-4">
          <AlertCircle size={18} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Categories Cards List - Responsive for iPhone & iPad */}
      {!loading && !error && categories.length === 0 && (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#EFE8DD] p-6">
          <UtensilsCrossed size={40} className="mx-auto text-[#D5C9BA] mb-2.5" />
          <p className="text-sm font-bold text-[#482015]">لا توجد فئات حاليًا</p>
          <p className="text-xs text-[#8C7D73] mt-1">اضغط على زر الإضافة لإنشاء أول فئة في المنيو.</p>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white border border-[#EFE8DD] hover:border-red-200 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 transition-all"
            >
              {/* Right side: 3 dots, image, name and product count */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/categories/${category.id}/edit`)}
                  className="text-[#B0A699] hover:text-[#DC2626] p-1 cursor-pointer"
                  aria-label={`تعديل فئة ${category.name}`}
                  title="تعديل الفئة"
                >
                  <MoreVertical size={18} />
                </button>

                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD3] shrink-0">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      🍽️
                    </div>
                  )}
                </div>

                <div className="flex flex-col text-right truncate">
                  <span className="text-sm font-black text-[#2E1E17] truncate">
                    {category.name}
                  </span>
                  <span className="text-[11px] font-semibold text-[#8C7D73] mt-0.5">
                    {category.productCount ?? 0} منتجات
                  </span>
                </div>
              </div>

              {/* Left side: Active Toggle Switch */}
              <div className="shrink-0 flex items-center gap-2">
                <ToggleSwitch
                  id={`cat-toggle-${category.id}`}
                  checked={category.isActive}
                  onChange={(val) => handleToggleActive(category, val)}
                  disabled={togglingId === category.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
