import { z } from 'zod';
import { ApiError } from '../utils/errors.js';

export const adminLoginSchema = z.object({
  username: z.string({ required_error: 'اسم المستخدم مطلوب.' })
    .trim()
    .min(3, 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.')
    .max(50, 'اسم المستخدم يجب ألا يتجاوز 50 حرفًا.'),
  password: z.string({ required_error: 'كلمة المرور مطلوبة.' })
    .min(1, 'كلمة المرور مطلوبة.')
    .max(128, 'كلمة المرور طويلة جدًا.'),
});

export function validateAdminLogin(body) {
  const result = adminLoginSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات تسجيل الدخول غير صحيحة.');
  }
  return result.data;
}
