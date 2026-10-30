import { z } from 'zod';
import { ApiError } from '../utils/errors.js';

export const updateSettingsSchema = z.object({
  restaurantName: z.string().trim().min(2, 'اسم المطعم يجب أن يتكون من حرفين على الأقل.').max(120, 'اسم المطعم يجب ألا يتجاوز 120 حرفًا.').optional(),
  isOpen: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  announcement: z.string().max(1000, 'الإعلان طويل جدًا.').optional(),
  phone: z.string().max(32, 'رقم الهاتف طويل جدًا.').optional(),
});

export function validateUpdateSettings(body) {
  const result = updateSettingsSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الإعدادات غير صحيحة.');
  }
  return result.data;
}
