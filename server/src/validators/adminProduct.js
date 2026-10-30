import { z } from 'zod';
import { ApiError } from '../utils/errors.js';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createProductSchema = z.object({
  name: z.string({ required_error: 'اسم الوجبة مطلوب.' })
    .trim()
    .min(2, 'اسم الوجبة يجب أن يتكون من حرفين على الأقل.')
    .max(120, 'اسم الوجبة يجب ألا يتجاوز 120 حرفًا.'),
  categoryId: z.string({ required_error: 'الفئة مطلوبة.' })
    .regex(objectIdRegex, 'معرّف الفئة غير صالح.'),
  price: z.coerce.number({ required_error: 'السعر مطلوب.' })
    .finite('السعر غير صالح.')
    .min(0, 'السعر لا يمكن أن يكون سالبًا.')
    .max(100000, 'السعر يتجاوز الحد المسموح به.')
    .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 0.000001, 'السعر يجب أن يحتوي على منزلتين عشريتين كحد أقصى.'),
  image: z.string().max(1000, 'رابط الصورة طويل جدًا.').default(''),
  description: z.string().max(1000, 'الوصف طويل جدًا.').default(''),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  badge: z.string().max(80).default(''),
  isSpicy: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export function validateCreateProduct(body) {
  const result = createProductSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الوجبة غير صحيحة.');
  }
  return result.data;
}

export function validateUpdateProduct(body) {
  const result = updateProductSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الوجبة غير صحيحة.');
  }
  return result.data;
}
