import { useState, useEffect, useCallback, useTransition } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, MoreVertical, Loader2, UtensilsCrossed, AlertCircle, Eye } from 'lucide-react';
import AdminLayout from '../../../components/admin/layout/AdminLayout.jsx';
import AdminPageHeader from '../../../components/admin/common/AdminPageHeader.jsx';
import ToggleSwitch from '../../../components/admin/common/ToggleSwitch.jsx';
import ProductPreviewModal from '../../../components/admin/products/ProductPreviewModal.jsx';
import {
  getAdminProducts,
  getAdminCategories,
  updateAdminProduct,
} from '../../../services/adminCatalogService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';
import { formatCurrency } from '../../../utils/format.js';

export default function ProductsListPage() {
  const navigate = useNavigate();
  const { csrfToken } = useAdminAuth();
  const [, startTransition] = useTransition();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const [previewProduct, setPreviewProduct] = useState(null);

  const fetchData = useCallback(async (catId = selectedCategory, search = searchTerm) => {
    try {
      const [prods, cats] = await Promise.all([
        getAdminProducts({ categoryId: catId || undefined, search: search || undefined }),
        categories.length === 0 ? getAdminCategories() : Promise.resolve(categories),
      ]);
      setProducts(prods || []);
      if (categories.length === 0) setCategories(cats || []);
      setError('');
    } catch (err) {
      setError(err.message || 'تعذّر تحميل المنتجات.');
    } finally {
      setLoading(false);
    }
  }, [categories, selectedCategory, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    startTransition(() => {
      fetchData(selectedCategory, val);
    });
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    fetchData(catId, searchTerm);
  };

  const handleToggleAvailability = async (product, newStatus) => {
    setTogglingId(product.id);
    try {
      const updated = await updateAdminProduct(product.id, { isAvailable: newStatus }, csrfToken);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isAvailable: updated.isAvailable } : p))
      );
    } catch (err) {
      alert(err.message || 'فشل تحديث توفر الوجبة.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="المنتجات"
        backTo="/admin"
      />

      {/* Search Input matching Screen 6 */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="البحث عن وجبة..."
          className="w-full pl-4 pr-10 py-3 bg-white border border-[#E8DFD3] rounded-2xl text-right text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15 transition-all shadow-xs"
        />
        <Search
          size={18}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C7D73] pointer-events-none"
        />
      </div>

      {/* Category Filter Pills / Dropdown */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none no-scrollbar">
        <button
          type="button"
          onClick={() => handleCategoryChange('')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === ''
              ? 'bg-[#DC2626] text-white shadow-xs'
              : 'bg-white text-[#482015] border border-[#EFE8DD] hover:bg-[#FAF6F0]'
          }`}
        >
          جميع الفئات
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-[#DC2626] text-white shadow-xs'
                : 'bg-white text-[#482015] border border-[#EFE8DD] hover:bg-[#FAF6F0]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Prominent Red Button matching Screen 6 */}
      <button
        type="button"
        onClick={() => navigate('/admin/products/new')}
        className="w-full py-3.5 px-4 mb-4 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold rounded-2xl shadow-sm shadow-red-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span>إضافة وجبة جديدة</span>
      </button>

      {/* Loading State */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626] mb-3" />
          <p className="text-xs text-[#8C7D73]">جاري تحميل المنتجات...</p>
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
      {!loading && !error && products.length === 0 && (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#EFE8DD] p-6">
          <UtensilsCrossed size={40} className="mx-auto text-[#D5C9BA] mb-2.5" />
          <p className="text-sm font-bold text-[#482015]">لم يتم العثور على وجبات</p>
          <p className="text-xs text-[#8C7D73] mt-1">جرب تغيير معايير البحث أو أضف وجبة جديدة.</p>
        </div>
      )}

      {/* Products List - Responsive for iPhone & iPad */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-[#EFE8DD] hover:border-red-200 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-3 transition-all"
            >
              {/* Right: Product Image & Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  onClick={() => setPreviewProduct(product)}
                  className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD3] shrink-0 cursor-pointer group/img"
                  title="معاينة الوجبة"
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      🍗
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                    <Eye size={16} className="text-white drop-shadow-xs" />
                  </div>
                </div>

                <div className="flex flex-col text-right truncate">
                  <span className="text-sm font-black text-[#2E1E17] truncate">
                    {product.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-[#DC2626]">
                      {formatCurrency(product.price)}
                    </span>
                    {product.categoryId?.name && (
                      <span className="text-[10px] font-semibold text-[#8C7D73] bg-[#FAF6F0] px-1.5 py-0.5 rounded-md border border-[#EFE8DD]">
                        {product.categoryId.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Left: Availability Toggle & Edit Icon */}
              <div className="shrink-0 flex items-center gap-2">
                <ToggleSwitch
                  id={`prod-toggle-${product.id}`}
                  checked={product.isAvailable}
                  onChange={(val) => handleToggleAvailability(product, val)}
                  disabled={togglingId === product.id}
                />

                <button
                  type="button"
                  onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                  className="text-[#B0A699] hover:text-[#DC2626] p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  aria-label={`تعديل وجبة ${product.name}`}
                  title="تعديل الوجبة"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Preview Modal matching Screen 9 */}
      <ProductPreviewModal
        product={previewProduct}
        onClose={() => setPreviewProduct(null)}
        onEdit={(prod) => {
          setPreviewProduct(null);
          navigate(`/admin/products/${prod.id}/edit`);
        }}
      />
    </AdminLayout>
  );
}
