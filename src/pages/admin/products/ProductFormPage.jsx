import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Trash2, AlertCircle } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ImageUploader from '../../../components/admin/common/ImageUploader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import ConfirmModal from '../../../components/admin/common/ConfirmModal.jsx';
import {
  getAdminCategories,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
} from '../../../services/adminCatalogService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { csrfToken } = useAdminAuth();

  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const [cats, prods] = await Promise.all([
          getAdminCategories(),
          isEditMode ? getAdminProducts() : Promise.resolve([]),
        ]);

        if (!active) return;
        setCategories(cats || []);

        if (isEditMode) {
          const target = (prods || []).find((p) => p.id === id || String(p._id) === id);
          if (target) {
            setName(target.name || '');
            setCategoryId(target.categoryId?._id ? String(target.categoryId._id) : (target.categoryId || ''));
            setPrice(String(target.price ?? ''));
            setDescription(target.description || '');
            setImage(target.image || '');
            setIsAvailable(target.isAvailable ?? true);
            setIsFeatured(target.isFeatured ?? false);
          } else {
            setError('الوجبة المطلوبة غير موجودة.');
          }
        } else if (cats && cats.length > 0) {
          setCategoryId(cats[0].id || String(cats[0]._id));
        }
      } catch (err) {
        if (active) setError(err.message || 'تعذّر تحميل البيانات.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('اسم الوجبة مطلوب ويجب أن يتكون من حرفين على الأقل.');
      return;
    }

    if (!categoryId) {
      setError('يرجى اختيار فئة للوجبة.');
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('يرجى إدخال سعر صحيح غير سالب.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        categoryId,
        price: numPrice,
        description: description.trim(),
        image: image || '',
        isAvailable,
        isFeatured,
      };

      if (isEditMode) {
        await updateAdminProduct(id, payload, csrfToken);
      } else {
        await createAdminProduct(payload, csrfToken);
      }

      navigate('/admin/products');
    } catch (err) {
      setError(err.message || 'فشل حفظ الوجبة، يرجى مراجعة البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteAdminProduct(id, csrfToken);
      setShowDeleteModal(false);
      navigate('/admin/products');
    } catch (err) {
      setError(err.message || 'فشل حذف الوجبة.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title={isEditMode ? 'تعديل الوجبة' : 'إضافة وجبة جديدة'}
        backTo="/admin/products"
      />

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل البيانات...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto w-full">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2.5">
              <AlertCircle size={17} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Image Uploader Card matching Screen 7 & 8 */}
          <div className="bg-white p-4 rounded-3xl border border-[#EFE8DD] shadow-xs">
            <label className="block text-xs font-bold text-[#482015] mb-2 text-right">
              صورة الوجبة
            </label>
            <ImageUploader
              value={image}
              onChange={setImage}
              label="صورة الوجبة"
              placeholder="اختر صورة الوجبة"
            />
          </div>

          {/* Form Fields Card */}
          <div className="bg-white p-4 rounded-3xl border border-[#EFE8DD] shadow-xs space-y-4">
            <div>
              <label
                htmlFor="prod-name"
                className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
              >
                اسم الوجبة *
              </label>
              <input
                id="prod-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: بروست 8 قطع"
                className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm"
                required
              />
            </div>

            {/* Category and Price in 2-column on iPad/Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="prod-cat"
                  className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
                >
                  الفئة *
                </label>
                <select
                  id="prod-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm cursor-pointer"
                  required
                >
                  <option value="" disabled>اختر الفئة</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="prod-price"
                  className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
                >
                  السعر (₪) *
                </label>
                <input
                  id="prod-price"
                  type="number"
                  step="0.5"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="prod-desc"
                className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
              >
                وصف قصير
              </label>
              <textarea
                id="prod-desc"
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="قطع دجاج مقرمشة ومميزة، تقدم مع البطاطا والثوم..."
                className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm resize-none"
              />
            </div>

            {/* Toggles matching Screen 7 & 8 */}
            <div className="pt-2 space-y-3 border-t border-[#F0E6D8]/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#482015]">متوفر في المنيو</span>
                <ToggleSwitch
                  id="prod-available"
                  checked={isAvailable}
                  onChange={setIsAvailable}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#482015]">منتج مميز</span>
                <ToggleSwitch
                  id="prod-featured"
                  checked={isFeatured}
                  onChange={setIsFeatured}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={saving || deleting}
              className="w-full py-3.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-2xl shadow-sm shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <span>{isEditMode ? 'حفظ التعديلات' : 'حفظ'}</span>
              )}
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={saving || deleting}
                className="w-full py-3 px-4 bg-transparent hover:bg-red-50 text-[#DC2626] border border-red-200 hover:border-red-300 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-60"
              >
                <Trash2 size={15} />
                <span>حذف الوجبة</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="حذف الوجبة"
        message="هل أنت متأكد من رغبتك في حذف هذه الوجبة؟ لن تتمكن من حذفها إذا كانت مرتبطة بعرض ترويجي نشط."
        confirmText="نعم، حذف الوجبة"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </AdminLayout>
  );
}
