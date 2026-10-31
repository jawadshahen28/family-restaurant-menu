import { z } from 'zod';

export const imageInput = {
  imageUrl: z.string().max(1000).optional(),
  imagePublicId: z.string().max(300).optional(),
  imageVersion: z.number().int().positive().nullable().optional(),
  imageUploadToken: z.string().max(4000).optional(),
};
