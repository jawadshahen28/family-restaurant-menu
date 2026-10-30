import { z } from 'zod';
import { normalizePhone } from '../../../src/utils/checkoutValidation.js';
import { ApiError } from '../utils/errors.js';

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'معرّف الصنف غير صحيح.');
const price = z.number().finite().min(0).max(990000000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < .000001, 'السعر غير صحيح.');
const plain = (max) => z.string().trim().max(max).refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), 'النص يحتوي أحرفًا غير صالحة.');

export const orderSchema = z.object({
  submissionId: z.uuid('معرّف محاولة الإرسال غير صحيح.'),
  confirmationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'رمز الوصول للطلب غير صحيح.'),
  customer: z.object({ name: plain(120).min(2, 'اكتب اسمك من حرفين على الأقل.').refine((value) => /\p{L}/u.test(value), 'اكتب اسمًا صحيحًا.'), phone: plain(32).refine((value) => !!normalizePhone(value), 'اكتب رقم هاتف صحيحًا.').transform(normalizePhone) }).strict(),
  fulfillmentType: z.enum(['pickup', 'delivery'], { error: 'اختَر الاستلام من المطعم أو التوصيل.' }),
  deliveryAddress: plain(1000).nullable().optional(),
  notes: plain(1000).default(''),
  items: z.array(z.object({ productId: objectId, offerId: objectId.nullable().optional(), quantity: z.number().int().min(1).max(99), expectedUnitPrice: price }).strict()).min(1, 'السلة فارغة.').max(100),
  expectedProductsSubtotal: price,
}).strict().superRefine((value, ctx) => {
  if (value.fulfillmentType === 'delivery' && (!value.deliveryAddress || value.deliveryAddress.length < 5)) ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'اكتب عنوان التوصيل: المنطقة، الشارع، وأقرب معلم.' });
  const keys = value.items.map((item) => item.productId.toLowerCase());
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['items'], message: 'يوجد صنف مكرر في الطلب. اجمع الكميات في بند واحد.' });
}).transform((value) => ({ ...value, deliveryAddress: value.fulfillmentType === 'delivery' ? value.deliveryAddress : null, items: value.items.map((item) => ({ ...item, productId: item.productId.toLowerCase(), offerId: item.offerId?.toLowerCase() || null })) }));

export function validateOrder(body) {
  const result = orderSchema.safeParse(body);
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
    throw new ApiError(422, 'VALIDATION_ERROR', 'راجع بيانات الطلب قبل الإرسال.', { fields });
  }
  return result.data;
}
