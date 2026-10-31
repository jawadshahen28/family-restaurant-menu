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
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '../../../services/adminCatalogService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { imagePayload } from '../../../utils/images.js';

export default function CategoryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { csrfToken } = useAdminAuth();

  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [imageAsset, setImageAsset] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;

    let active = true;
    getAdminCategories()
      .then((cats) => {
        if (!active) return;
        const target = (cats || []).find((c) => c.id === id || String(c._id) === id);
        if (target) {
          setName(target.name || '');
          setImage(target.imageUrl || target.image || '');
          setImageAsset(null);
          setSortOrder(String(target.sortOrder ?? 0));
          setIsActive(target.isActive ?? true);
        } else {
          setError('الفئة المطلوبة غير موجودة.');
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'تعذّر تحميل بيانات الفئة.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (imageUploading) return;

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('اسم الفئة مطلوب ويجب أن يتكون من حرفين على الأقل.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        ...imagePayload(image, imageAsset),
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };

      if (isEditMode) {
        await updateAdminCategory(id, payload, csrfToken);
      } else {
        await createAdminCategory(payload, csrfToken);
      }

      navigate('/admin/categories');
    } catch (err) {
      setError(err.message || 'فشل حفظ الفئة، يرجى التحقق من البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteAdminCategory(id, csrfToken);
      setShowDeleteModal(false);
      navigate('/admin/categories');
    } catch (err) {
      setError(err.message || 'فشل حذف الفئة.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title={isEditMode ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
        backTo="/admin/categories"
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

          {/* Image Uploader Card matching Screen 4 & 5 */}
          <div className="bg-white p-4 rounded-3xl border border-[#EFE8DD] shadow-xs">
            <label className="block text-xs font-bold text-[#482015] mb-2 text-right">
              صورة الفئة
            </label>
            <ImageUploader
              value={image}
              onChange={(url, asset) => { setImage(url); setImageAsset(asset); }}
              onUploadStateChange={setImageUploading}
              folder="categories"
              label="صورة الفئة"
              placeholder="اختر صورة الفئة"
            />
          </div>

          {/* Form Fields Card */}
          <div className="bg-white p-4 rounded-3xl border border-[#EFE8DD] shadow-xs space-y-4">
            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
              >
                اسم الفئة *
              </label>
              <input
                id="cat-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: البروست، ساندويشات..."
                className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm"
                required
              />
            </div>

            <div>
              <label
                htmlFor="cat-order"
                className="block text-xs font-bold text-[#482015] mb-1.5 text-right"
              >
                ترتيب العرض
              </label>
              <input
                id="cat-order"
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right font-medium text-gray-800 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all text-sm"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#F0E6D8]/60">
              <span className="text-xs font-bold text-[#482015]">إظهار الفئة في المنيو</span>
              <ToggleSwitch
                id="cat-active"
                checked={isActive}
                onChange={setIsActive}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={saving || deleting || imageUploading}
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
                <span>حذف الفئة</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="حذف الفئة"
        message="هل أنت متأكد من رغبتك في حذف هذه الفئة؟ سيتم منع الحذف إذا كانت تحتوي على وجبات مرتبطة بها."
        confirmText="نعم، حذف الفئة"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </AdminLayout>
  );
}
