import { z } from 'zod';
import { ApiError } from '../utils/errors.js';
import { imageInput } from './image.js';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createOfferSchema = z.object({
  ...imageInput,
  title: z.string({ required_error: 'عنوان العرض مطلوب.' })
    .trim()
    .min(2, 'عنوان العرض يجب أن يتكون من حرفين على الأقل.')
    .max(120, 'عنوان العرض يجب ألا يتجاوز 120 حرفًا.'),
  productId: z.string({ required_error: 'الوجبة المرتبطة مطلوبة.' })
    .regex(objectIdRegex, 'معرّف الوجبة غير صالح.'),
  originalPrice: z.coerce.number({ required_error: 'السعر الأصلي مطلوب.' })
    .finite('السعر الأصلي غير صالح.')
    .min(0, 'السعر الأصلي لا يمكن أن يكون سالبًا.')
    .max(100000, 'السعر الأصلي يتجاوز الحد المسموح به.')
    .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 0.000001, 'السعر الأصلي يجب أن يحتوي على منزلتين عشريتين كحد أقصى.'),
  offerPrice: z.coerce.number({ required_error: 'سعر العرض مطلوب.' })
    .finite('سعر العرض غير صالح.')
    .min(0, 'سعر العرض لا يمكن أن يكون سالبًا.')
    .max(100000, 'سعر العرض يتجاوز الحد المسموح به.')
    .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 0.000001, 'سعر العرض يجب أن يحتوي على منزلتين عشريتين كحد أقصى.'),
  startDate: z.string({ required_error: 'تاريخ بداية العرض مطلوب.' })
    .refine((val) => !isNaN(Date.parse(val)), 'تاريخ بداية العرض غير صالح.'),
  endDate: z.string({ required_error: 'تاريخ نهاية العرض مطلوب.' })
    .refine((val) => !isNaN(Date.parse(val)), 'تاريخ نهاية العرض غير صالح.'),
  image: z.string().max(1000, 'رابط الصورة طويل جدًا.').default(''),
  description: z.string().max(1000, 'الوصف طويل جدًا.').default(''),
  isActive: z.boolean().default(true),
}).refine(
  (data) => data.offerPrice <= data.originalPrice,
  { message: 'سعر العرض لا يمكن أن يتجاوز السعر الأصلي.', path: ['offerPrice'] }
).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'تاريخ انتهاء العرض يجب أن يلي تاريخ البداية.', path: ['endDate'] }
);

export const updateOfferSchema = z.object({
  ...imageInput,
  title: z.string().trim().min(2, 'عنوان العرض يجب أن يتكون من حرفين على الأقل.').max(120, 'عنوان العرض يجب ألا يتجاوز 120 حرفًا.').optional(),
  productId: z.string().regex(objectIdRegex, 'معرّف الوجبة غير صالح.').optional(),
  originalPrice: z.coerce.number()
    .finite('السعر الأصلي غير صالح.')
    .min(0, 'السعر الأصلي لا يمكن أن يكون سالبًا.')
    .max(100000, 'السعر الأصلي يتجاوز الحد المسموح به.')
    .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 0.000001, 'السعر الأصلي يجب أن يحتوي على منزلتين عشريتين كحد أقصى.')
    .optional(),
  offerPrice: z.coerce.number()
    .finite('سعر العرض غير صالح.')
    .min(0, 'سعر العرض لا يمكن أن يكون سالبًا.')
    .max(100000, 'سعر العرض يتجاوز الحد المسموح به.')
    .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 0.000001, 'سعر العرض يجب أن يحتوي على منزلتين عشريتين كحد أقصى.')
    .optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'تاريخ بداية العرض غير صالح.').optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'تاريخ نهاية العرض غير صالح.').optional(),
  image: z.string().max(1000, 'رابط الصورة طويل جدًا.').optional(),
  description: z.string().max(1000, 'الوصف طويل جدًا.').optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.offerPrice !== undefined && data.originalPrice !== undefined) {
      return data.offerPrice <= data.originalPrice;
    }
    return true;
  },
  { message: 'سعر العرض لا يمكن أن يتجاوز السعر الأصلي.', path: ['offerPrice'] }
).refine(
  (data) => {
    if (data.startDate !== undefined && data.endDate !== undefined) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: 'تاريخ انتهاء العرض يجب أن يلي تاريخ البداية.', path: ['endDate'] }
);

export function validateCreateOffer(body) {
  const result = createOfferSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات العرض غير صحيحة.');
  }
  return result.data;
}

export function validateUpdateOffer(body) {
  const result = updateOfferSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات العرض غير صحيحة.');
  }
  return result.data;
}
