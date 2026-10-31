import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { uploadAdminImage } from '../../../services/adminCatalogService.js';
import { useAdminAuth } from '../../../context/AdminAuthContext.jsx';

export default function ImageUploader({
  value,
  onChange,
  onUploadStateChange,
  folder = 'products',
  label = 'صورة الوجبة',
  placeholder = 'اختر صورة الوجبة',
}) {
  const { csrfToken } = useAdminAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    // Client-side quick validation
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('نوع الصورة غير مدعوم. اختر صورة بصيغة JPG أو PNG أو WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة كبير جدًا (أقصى حد 5 ميجابايت).');
      return;
    }

    // Set immediate client preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    onUploadStateChange?.(true);
    try {
      const result = await uploadAdminImage(file, csrfToken, folder);
      if (!result.imageUrl || !result.imageUploadToken) throw new Error('لم يكتمل رفع الصورة إلى الخادم. أعد المحاولة.');
      onChange(result.imageUrl, result);
      setPreviewUrl('');
    } catch (err) {
      setError(err.message || 'فشل رفع الصورة، يرجى المحاولة مرة أخرى.');
      setPreviewUrl('');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      onUploadStateChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentDisplayImage = previewUrl || value;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        disabled={uploading}
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload-input"
      />

      {currentDisplayImage ? (
        <div className="flex items-center gap-4 p-3 bg-white border border-[#EFE8DD] rounded-2xl shadow-xs">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD3] shrink-0">
            <img
              src={currentDisplayImage}
              alt={label}
              className="w-full h-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="py-2 px-4 bg-[#FFF8EE] hover:bg-[#FEEFD9] text-[#482015] border border-[#F4E1C4] rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {uploading ? 'جاري الرفع...' : 'تغيير الصورة'}
            </button>
            <span className="text-[11px] text-[#8C7D73]">JPG, PNG, WebP (بحد أقصى 5MB)</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-6 px-4 bg-white border-2 border-dashed border-[#E5DACD] hover:border-[#DC2626] rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] text-[#DC2626] flex items-center justify-center group-hover:scale-105 transition-transform">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-[#DC2626]" />
            ) : (
              <Camera size={24} strokeWidth={1.8} />
            )}
          </div>
          <span className="text-xs font-bold text-[#482015] group-hover:text-[#DC2626] transition-colors">
            {uploading ? 'جاري رفع الصورة...' : placeholder}
          </span>
          <span className="text-[10px] text-[#8C7D73]">اختر من ألبوم الصور أو اسحب الصورة هنا</span>
        </button>
      )}

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
