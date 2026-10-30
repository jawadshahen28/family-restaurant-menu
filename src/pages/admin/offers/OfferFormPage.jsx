import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Trash2, AlertCircle, Calendar } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ImageUploader from '../../../components/admin/common/ImageUploader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import ConfirmModal from '../../../components/admin/common/ConfirmModal.jsx';
import {
  getAdminOffers,
  getAdminOffer,
  createAdminOffer,
  updateAdminOffer,
  deleteAdminOffer,
} from '../../../services/adminOffersService.js';
import { getAdminProducts } from '../../../services/adminCatalogService.js';
import { clearMenuCache } from '../../../services/menuService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { toLocalDatetimeInput, fromLocalDatetimeInput } from '../../../utils/format.js';

export default function OfferFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { csrfToken } = useAdminAuth();

  const [products, setProducts] = useState([]);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [startDate, setStartDate] = useState(() => toLocalDatetimeInput(new Date().toISOString()));
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return toLocalDatetimeInput(nextWeek.toISOString());
  });
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const [prodsList, offerData] = await Promise.all([
          getAdminProducts(),
          isEditMode ? getAdminOffer(id) : Promise.resolve(null),
        ]);

        if (!active) return;
        setProducts(prodsList || []);

        if (isEditMode) {
          if (offerData) {
            setTitle(offerData.title || '');
            const pId = offerData.productId?._id ? String(offerData.productId._id) : (offerData.productId || '');
            setProductId(pId);
            setDescription(offerData.description || '');
            setImage(offerData.image || '');
            setOriginalPrice(String(offerData.originalPrice ?? ''));
            setOfferPrice(String(offerData.offerPrice ?? ''));
            setStartDate(toLocalDatetimeInput(offerData.startDate));
            setEndDate(toLocalDatetimeInput(offerData.endDate));
            setIsActive(offerData.isActive ?? true);
          } else {
            setError('العرض المطلوب غير موجود.');
          }
        } else if (prodsList && prodsList.length > 0) {
          const firstProd = prodsList[0];
          setProductId(firstProd.id || String(firstProd._id));
          setOriginalPrice(String(firstProd.price ?? ''));
          if (firstProd.image) setImage(firstProd.image);
        }
      } catch (err) {
        if (active) setError(err.message || 'تعذّر تحميل البيانات.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  const handleProductSelect = (selectedProdId) => {
    setProductId(selectedProdId);
    const prod = products.find((p) => p.id === selectedProdId || String(p._id) === selectedProdId);
    if (prod) {
      if (!originalPrice || !isEditMode) {
        setOriginalPrice(String(prod.price ?? ''));
      }
      if (!image && prod.image) {
        setImage(prod.image);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('يرجى إدخال عنوان العرض.');
      return;
    }

    if (!productId) {
      setError('يرجى اختيار الوجبة المرتبطة بالعرض.');
      return;
    }

    const orig = parseFloat(originalPrice);
    const off = parseFloat(offerPrice);

    if (isNaN(orig) || orig < 0) {
      setError('يرجى إدخال سعر أصلي صالح.');
      return;
    }

    if (isNaN(off) || off < 0) {
      setError('يرجى إدخال سعر عرض صالح.');
      return;
    }

    if (off > orig) {
      setError('سعر العرض لا يمكن أن يتجاوز السعر الأصلي.');
      return;
    }

    if (!startDate || !endDate) {
      setError('يرجى تحديد تاريخ البداية وتاريخ النهاية.');
      return;
    }

    const startUtc = fromLocalDatetimeInput(startDate);
    const endUtc = fromLocalDatetimeInput(endDate);

    if (new Date(endUtc) < new Date(startUtc)) {
      setError('تاريخ انتهاء العرض يجب أن يلي تاريخ البداية.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        productId,
        description: description.trim(),
        image: image.trim(),
        originalPrice: orig,
        offerPrice: off,
        startDate: startUtc,
        endDate: endUtc,
        isActive,
      };

      if (isEditMode) {
        await updateAdminOffer(id, payload, csrfToken);
      } else {
        await createAdminOffer(payload, csrfToken);
      }
      clearMenuCache();
      navigate('/admin/offers');
    } catch (err) {
      setError(err.message || 'فشل حفظ العرض.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAdminOffer(id, csrfToken);
      setShowDeleteModal(false);
      navigate('/admin/offers');
    } catch (err) {
      setError(err.message || 'فشل حذف العرض.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title={isEditMode ? 'تعديل العرض' : 'إضافة عرض جديد'}
        backTo="/admin/offers"
      />

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل بيانات العرض...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pb-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Offer Image Uploader */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs">
            <label className="block text-xs font-bold text-[#482015] mb-2">
              صورة العرض
            </label>
            <ImageUploader
              value={image}
              onChange={setImage}
              csrfToken={csrfToken}
              folder="offers"
            />
          </div>

          {/* Main Information Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs space-y-3.5">
            <div>
              <label htmlFor="offer-title" className="block text-xs font-bold text-[#482015] mb-1.5">
                عنوان العرض <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="offer-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: عرض التوفير العائلي"
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="offer-product" className="block text-xs font-bold text-[#482015] mb-1.5">
                الوجبة المرتبطة بالعرض <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="offer-product"
                value={productId}
                onChange={(e) => handleProductSelect(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all cursor-pointer"
              >
                {products.length === 0 ? (
                  <option value="">لا توجد وجبات متاحة</option>
                ) : (
                  products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.price} ₪)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="offer-description" className="block text-xs font-bold text-[#482015] mb-1.5">
                وصف العرض
              </label>
              <textarea
                id="offer-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="تفاصيل العرض، الوجبات المشمولة، أو المشروبات المرفقة..."
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          {/* Pricing Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#482015] mb-3">تفاصيل الأسعار</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="offer-original-price" className="block text-xs font-bold text-[#482015] mb-1.5">
                  السعر الأصلي (₪) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="offer-original-price"
                  type="number"
                  step="0.5"
                  min="0"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label htmlFor="offer-price" className="block text-xs font-bold text-[#482015] mb-1.5">
                  سعر العرض (₪) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="offer-price"
                  type="number"
                  step="0.5"
                  min="0"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#DC2626] font-bold focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Date & Schedule Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#482015] mb-3">
              <Calendar size={15} className="text-[#DC2626]" />
              <span>فترة صلاحية العرض (بتوقيت فلسطين)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="offer-start-date" className="block text-xs font-semibold text-[#8C7D73] mb-1.5">
                  تاريخ ووقت البداية <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="offer-start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label htmlFor="offer-end-date" className="block text-xs font-semibold text-[#8C7D73] mb-1.5">
                  تاريخ ووقت النهاية <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="offer-end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#E8DFD3] rounded-xl text-right text-sm text-[#2E1E17] focus:outline-none focus:border-[#DC2626] focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Status Toggle Card */}
          <div className="bg-white border border-[#EFE8DD] rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="block text-sm font-bold text-[#2E1E17]">
                تفعيل العرض
              </span>
              <span className="text-xs text-[#8C7D73]">
                إظهار العرض في المنيو للزبائن خلال فترة الصلاحية
              </span>
            </div>
            <ToggleSwitch
              id="offer-active-toggle"
              checked={isActive}
              onChange={setIsActive}
              aria-label="تفعيل العرض"
            />
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
              <span>حفظ العرض</span>
            )}
          </button>

          {/* Delete Button (Edit Mode Only) */}
          {isEditMode && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
              className="w-full py-3 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Trash2 size={16} />
              <span>حذف هذا العرض</span>
            </button>
          )}
        </form>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="حذف العرض"
        message={`هل أنت متأكد من رغبتك في حذف عرض «${title}»؟ لن يتمكن الزبائن من رؤيته أو الاستفادة منه.`}
        confirmLabel="نعم، حذف العرض"
        cancelLabel="إلغاء"
        isDanger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </AdminLayout>
  );
}
