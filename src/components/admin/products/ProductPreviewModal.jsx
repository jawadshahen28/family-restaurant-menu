import { X, Edit3, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/format.js';

export default function ProductPreviewModal({ product, onClose, onEdit }) {
  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#EFE8DD] animate-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh]">
        {/* Top Image with Close Button */}
        <div className="relative w-full h-48 bg-[#FAF6F0]">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🍗
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
            aria-label="إغلاق المعاينة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Details Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-right">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[#2E1E17] leading-tight">
                {product.name}
              </h3>
              <p className="text-base font-bold text-[#DC2626] mt-1">
                {formatCurrency(product.price)}
              </p>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                product.isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {product.isAvailable ? 'متوفر' : 'غير متوفر'}
            </span>
          </div>

          {product.description && (
            <p className="text-xs text-[#7D7067] leading-relaxed bg-[#FAF6F0] p-3 rounded-xl border border-[#EFE8DD]">
              {product.description}
            </p>
          )}

          {/* Meta Info Table matching Screen 9 */}
          <div className="space-y-2 text-xs border-t border-[#F0E6D8] pt-3 text-[#7D7067]">
            <div className="flex justify-between items-center py-1 border-b border-[#F5EFE6]">
              <span className="font-semibold text-[#8C7D73]">الفئة</span>
              <span className="font-bold text-[#2E1E17]">{product.categoryId?.name || '—'}</span>
            </div>
            {product.createdAt && (
              <div className="flex justify-between items-center py-1 border-b border-[#F5EFE6]">
                <span className="font-semibold text-[#8C7D73]">تاريخ الإضافة</span>
                <span className="font-medium text-[#482015]">{formatDate(product.createdAt)}</span>
              </div>
            )}
            {product.updatedAt && (
              <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-[#8C7D73]">آخر تحديث</span>
                <span className="font-medium text-[#482015]">{formatDate(product.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-[#EFE8DD] bg-[#FAF6F0] flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="flex-1 py-2.5 px-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Edit3 size={15} />
            <span>تعديل الوجبة</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-white border border-[#E8DFD3] text-[#482015] hover:bg-[#F5F2EB] text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
