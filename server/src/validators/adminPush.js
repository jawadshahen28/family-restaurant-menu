import { z } from 'zod';

export const subscribeSchema = z.object({
  endpoint: z.string().url({ message: 'رابط اشتراك الإشعارات غير صالح.' }),
  keys: z.object({
    p256dh: z.string().min(1, { message: 'مفتاح p256dh مطلوب.' }),
    auth: z.string().min(1, { message: 'مفتاح auth مطلوب.' }),
  }),
  device: z.object({
    userAgent: z.string().max(500).optional(),
    platform: z.string().max(100).optional(),
    label: z.string().max(100).optional(),
  }).optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url({ message: 'رابط اشتراك الإشعارات غير صالح.' }),
});
