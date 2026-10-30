const numbers = new Intl.NumberFormat('ar-PS-u-nu-latn', { maximumFractionDigits: 2 });
export function formatPrice(value) { return `${numbers.format(value)} ₪`; }
export function formatCount(value) { return numbers.format(value); }
export function formatItemCount(value) {
  if (value === 1) return 'قطعة واحدة';
  if (value === 2) return 'قطعتان';
  return `${numbers.format(value)} ${value >= 3 && value <= 10 ? 'قطع' : 'قطعة'}`;
}
export function formatCategoryCount(value) {
  if (value === 1) return 'صنف واحد';
  if (value === 2) return 'صنفان';
  return `${numbers.format(value)} ${value >= 3 && value <= 10 ? 'أصناف' : 'صنفًا'}`;
}
export const formatCurrency = formatPrice;
export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ar-PS-u-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function getTimezoneOffsetMs(date, timeZone = 'Asia/Hebron') {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return tzDate.getTime() - utcDate.getTime();
}

export function toLocalDatetimeInput(dateStr, timeZone = 'Asia/Hebron') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const offset = getTimezoneOffsetMs(d, timeZone);
  const target = new Date(d.getTime() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T${pad(target.getUTCHours())}:${pad(target.getUTCMinutes())}`;
}

export function fromLocalDatetimeInput(localStr, timeZone = 'Asia/Hebron') {
  if (!localStr) return '';
  const [dPart, tPart] = localStr.split('T');
  if (!dPart || !tPart) return new Date(localStr).toISOString();
  const [y, m, d] = dPart.split('-').map(Number);
  const [h, min] = tPart.split(':').map(Number);
  const approxUtc = new Date(Date.UTC(y, m - 1, d, h, min));
  const offset = getTimezoneOffsetMs(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offset).toISOString();
}

export function getOfferStatus(offer, now = Date.now()) {
  if (!offer.isActive) {
    return {
      code: 'disabled',
      label: 'معطل',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  const startTime = new Date(offer.startDate).getTime();
  const endTime = new Date(offer.endDate).getTime();
  if (startTime > now) {
    return {
      code: 'scheduled',
      label: 'مجدول',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (endTime < now) {
    return {
      code: 'expired',
      label: 'منتهي',
      badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
    };
  }
  return {
    code: 'active',
    label: 'نشط',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

export function getOrderStatusInfo(status) {
  switch (status) {
    case 'new':
    case 'confirmed':
      return {
        code: 'new',
        label: 'جديد',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        nextAction: 'received',
        nextActionLabel: 'تم استلام الطلب',
      };
    case 'received':
    case 'preparing':
      return {
        code: 'received',
        label: 'تم استلام الطلب',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
        nextAction: 'prepared',
        nextActionLabel: 'تم التجهيز',
      };
    case 'prepared':
    case 'ready':
    case 'completed':
      return {
        code: 'prepared',
        label: 'تم التجهيز',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
        nextAction: null,
        nextActionLabel: null,
      };
    default:
      return {
        code: 'new',
        label: 'جديد',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        nextAction: 'received',
        nextActionLabel: 'تم استلام الطلب',
      };
  }
}

export function formatOrderTime(dateStr, timeZone = 'Asia/Jerusalem') {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('ar-PS-u-nu-latn', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(dateStr));
}
