import { AlertTriangle, Loader2 } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'نعم، حذف',
  cancelText = 'إلغاء',
  isDanger = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#EFE8DD] text-center animate-in zoom-in-95 duration-150">
        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 ${isDanger ? 'bg-red-50 text-[#DC2626]' : 'bg-amber-50 text-amber-600'}`}>
          <AlertTriangle size={24} strokeWidth={2} />
        </div>
        <h3 className="text-base font-bold text-[#2E1E17] mb-1.5">{title}</h3>
        <p className="text-xs text-[#7D7067] leading-relaxed mb-5">{message}</p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              isDanger ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#482015] hover:bg-[#2E1E17]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            <span>{confirmText}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 bg-[#F5F2EB] hover:bg-[#EAE5DC] text-[#482015] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
