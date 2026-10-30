import { useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';

export default function AdminPageHeader({
  title,
  subtitle,
  backTo = '/admin',
  actionButton,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F0E6D8]/60">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="w-9 h-9 rounded-xl bg-white border border-[#EFE8DD] text-[#482015] hover:text-[#DC2626] hover:border-red-200 shadow-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
          aria-label="الرجوع"
        >
          <ChevronRight size={20} strokeWidth={2.2} />
        </button>
        <div>
          <h1 className="text-base font-black text-[#2E1E17] leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-[#8C7D73] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
}
