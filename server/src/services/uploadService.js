import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ApiError } from '../utils/errors.js';

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function createUploadService({ uploadsDir = path.resolve('public/uploads') } = {}) {
  // Ensure the destination directory exists
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch {}

  return {
    /**
     * Uploads an image either to Cloudinary (if configured) or local persistent storage.
     * @param {Object} options
     * @param {string} options.data - Base64 data string (with or without data URL prefix)
     * @param {string} options.mimeType - MIME type of the image
     * @param {string} [options.filename] - Original filename
     * @returns {Promise<{ url: string }>}
     */
    async uploadImage({ data, mimeType, filename }) {
      if (!data || typeof data !== 'string') {
        throw new ApiError(400, 'INVALID_UPLOAD', 'بيانات الصورة غير صحيحة أو مفقودة.');
      }

      // Extract base64 and actual mime type if passed as data URL
      let cleanBase64 = data;
      let actualMime = (mimeType || '').toLowerCase();

      const dataUrlMatch = /^data:([a-zA-Z0-9/+-]+);base64,(.+)$/.exec(data);
      if (dataUrlMatch) {
        actualMime = dataUrlMatch[1].toLowerCase();
        cleanBase64 = dataUrlMatch[2];
      }

      if (!ALLOWED_MIME_TYPES[actualMime]) {
        throw new ApiError(400, 'UNSUPPORTED_IMAGE_TYPE', 'نوع الصورة غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.');
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length === 0) {
        throw new ApiError(400, 'EMPTY_IMAGE', 'الملف المحدد فارغ.');
      }

      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new ApiError(400, 'IMAGE_TOO_LARGE', 'حجم الصورة كبير جدًا. الحد الأقصى المسموح به هو 5 ميجابايت.');
      }

      // Check if Cloudinary is configured
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (cloudName && apiKey && apiSecret) {
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          const folder = 'family_restaurant';
          const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
          const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

          const formData = new FormData();
          formData.append('file', `data:${actualMime};base64,${cleanBase64}`);
          formData.append('api_key', apiKey);
          formData.append('timestamp', String(timestamp));
          formData.append('folder', folder);
          formData.append('signature', signature);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();
            return { url: result.secure_url || result.url };
          }
        } catch {
          // If Cloudinary fails, fallback safely to local persistent storage
        }
      }

      // Local persistent storage
      const ext = ALLOWED_MIME_TYPES[actualMime] || '.jpg';
      const uniqueName = `img-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      await fs.promises.writeFile(filePath, buffer);

      return {
        url: `/uploads/${uniqueName}`,
      };
    },
  };
}
