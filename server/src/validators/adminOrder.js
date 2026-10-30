import { z } from 'zod';
import { ApiError } from '../utils/errors.js';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const orderIdSchema = z.string({ required_error: 'معرّف الطلب مطلوب.' })
  .regex(objectIdRegex, 'معرّف الطلب غير صالح.');

export const updateOrderStatusSchema = z.object({
  status: z.enum(['received', 'prepared'], {
    errorMap: () => ({ message: 'الحالة غير صالحة. الحالات المسموح بها هي: تم استلام الطلب أو تم التجهيز.' }),
  }),
});

export function validateUpdateOrderStatus(body) {
  const result = updateOrderStatusSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, 'VALIDATION_ERROR', issue?.message || 'بيانات الحالة غير صحيحة.');
  }
  return result.data;
}
