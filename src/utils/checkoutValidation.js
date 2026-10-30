export function normalizePhone(value) {
  const digits = String(value || '').trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  if (!/^[+\d\s().-]+$/.test(digits)) return '';
  let phone = digits.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^\+?97[02]/.test(phone)) {
    phone = phone.replace(/^\+?97[02]/, '');
    if (!phone.startsWith('0')) phone = `0${phone}`;
  }
  if (/^(?:5\d{8}|[2489]\d{7})$/.test(phone)) phone = `0${phone}`;
  // Accept commonly used local mobile and Palestinian fixed-line formats.
  return /^(?:05\d{8}|0[2489]\d{7})$/.test(phone) ? phone : '';
}

export function validateCheckout(input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const address = typeof input.deliveryAddress === 'string' ? input.deliveryAddress.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const errors = {};
  if (!name) errors.name = 'اكتب اسمك حتى نعرف لمين الطلب.';
  else if (name.length < 2 || !/\p{L}/u.test(name)) errors.name = 'اكتب اسمًا صحيحًا من حرفين على الأقل.';
  else if (name.length > 120) errors.name = 'الاسم طويل، اكتبه في ١٢٠ حرفًا أو أقل.';
  if (!rawPhone) errors.phone = 'اكتب رقم هاتفك.';
  else if (!normalizePhone(rawPhone)) errors.phone = 'اكتب رقم هاتف صحيحًا، مثل 0599123456 أو +970599123456.';
  if (!['pickup', 'delivery'].includes(input.fulfillmentType)) errors.fulfillmentType = 'اختَر الاستلام من المطعم أو التوصيل.';
  if (input.fulfillmentType === 'delivery' && !address) errors.deliveryAddress = 'اكتب عنوان التوصيل: المنطقة، الشارع، وأقرب معلم.';
  else if (input.fulfillmentType === 'delivery' && address.length < 5) errors.deliveryAddress = 'وضّح عنوان التوصيل أكثر حتى يسهل الوصول إليك.';
  else if (input.fulfillmentType === 'delivery' && address.length > 1000) errors.deliveryAddress = 'اكتب العنوان في ١٠٠٠ حرف أو أقل.';
  if (notes.length > 1000) errors.notes = 'اكتب الملاحظات في ١٠٠٠ حرف أو أقل.';
  return {
    errors,
    values: { name, phone: normalizePhone(rawPhone), fulfillmentType: input.fulfillmentType, deliveryAddress: input.fulfillmentType === 'delivery' ? address : null, notes },
  };
}
