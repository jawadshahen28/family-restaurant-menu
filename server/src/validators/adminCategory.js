import { z } from 'zod';
import { ApiError } from '../utils/errors.js';
import { imageInput } from './image.js';

export const createCategorySchema = z.object({
  ...imageInput,
  name: z.string({ required_error: 'اسم الفئة مطلوب.' })
    .trim()
    .min(2, 'اسم الفئة يجب أن يتكون من حرفين على الأقل.')
    .max(120, 'اسم الفئة يجب ألا يتجاوز 120 حرفًا.'),
  image: z.string().max(1000, 'رابط الصورة طويل جدًا.').default(''),
  icon: z.string().max(40).default('drumstick'),
  description: z.string().max(1000, 'الوصف طويل جدًا.').default(''),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export function validateCreateCategory(body) {
  const result = createCategorySchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الفئة غير صحيحة.');
  }
  return result.data;
}

export function validateUpdateCategory(body) {
  const result = updateCategorySchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الفئة غير صحيحة.');
  }
  // Preserve the saved image (and other omitted fields) on availability-only edits.
  return Object.fromEntries(Object.entries(result.data).filter(([key]) => Object.hasOwn(body, key)));
}
