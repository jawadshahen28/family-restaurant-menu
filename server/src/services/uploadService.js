import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ApiError } from '../utils/errors.js';
import { imageFields } from '../utils/images.js';

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const developmentReceiptKey = crypto.randomBytes(32);
const managedId = value => /^family_restaurant\/[a-zA-Z0-9_/-]+$/.test(value || '');

export function cloudinaryEnvironment(source = process.env) {
  return { cloudName: source.CLOUDINARY_CLOUD_NAME || '', apiKey: source.CLOUDINARY_API_KEY || '', apiSecret: source.CLOUDINARY_API_SECRET || '' };
}

export function storedImage(record = {}) {
  const fields = imageFields(record);
  try {
    const url = new URL(fields.imageUrl);
    const match = url.pathname.match(/^\/([^/]+)\/image\/upload\/(?:v(\d+)\/)?(family_restaurant\/[a-zA-Z0-9_/-]+)\.[a-zA-Z0-9]+$/);
    if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && match && (!fields.imagePublicId || fields.imagePublicId === match[3])) {
      return { ...fields, imagePublicId: match[3], imageVersion: fields.imageVersion || Number(match[2]) || null, cloudName: match[1] };
    }
  } catch {}
  return { ...fields, cloudName: '' };
}

export function createUploadService({ uploadsDir = path.resolve('public/uploads'), nodeEnv = process.env.NODE_ENV || 'development', cloudinary = cloudinaryEnvironment(), fetcher = globalThis.fetch, now = Date.now } = {}) {
  const configured = Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret);
  const partial = Object.values(cloudinary).some(Boolean);
  const key = configured ? cloudinary.apiSecret : developmentReceiptKey;
  const mac = data => crypto.createHmac('sha256', key).update('family-image-upload-v1:' + data).digest('base64url');
  const issueReceipt = (asset, owner) => {
    const payload = Buffer.from(JSON.stringify({ ...asset, owner, expires: now() + 86400000 })).toString('base64url');
    return payload + '.' + mac(payload);
  };
  function verifyReceipt(token, owner) {
    try {
      const [payload, signature, extra] = token.split('.');
      const actual = Buffer.from(signature || '');
      const expected = Buffer.from(mac(payload));
      if (extra || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error();
      const asset = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (asset.owner !== owner || asset.expires < now()) throw new Error();
      return asset;
    } catch { throw new ApiError(400, 'INVALID_IMAGE_UPLOAD', 'بيانات رفع الصورة غير صالحة أو انتهت صلاحيتها. أعد رفع الصورة.'); }
  }
  function requireCloudinary() {
    if (!configured || !/^[a-zA-Z0-9_-]+$/.test(cloudinary.cloudName)) {
      throw new ApiError(503, 'CLOUDINARY_NOT_CONFIGURED', 'رفع الصور غير مهيأ. أضف إعدادات Cloudinary إلى الخادم.');
    }
  }
  async function signedRequest(action, parameters, file) {
    requireCloudinary();
    const params = { ...parameters, timestamp: String(Math.floor(now() / 1000)) };
    const signature = crypto.createHash('sha1').update(Object.keys(params).sort().map(name => `${name}=${params[name]}`).join('&') + cloudinary.apiSecret).digest('hex');
    const form = new FormData();
    for (const [name, value] of Object.entries(params)) form.append(name, String(value));
    form.append('api_key', cloudinary.apiKey);
    form.append('signature', signature);
    if (file) form.append('file', file);
    try {
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/${action}`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch { throw new ApiError(502, 'CLOUDINARY_REQUEST_FAILED', 'تعذّر إتمام العملية على Cloudinary. حاول مجددًا؛ لم تُستبدل الصورة المحفوظة.'); }
  }
  return {
    isConfigured: () => configured,
    async uploadImage({ data, mimeType, folder = 'products' }, owner = '') {
      if (!data || typeof data !== 'string') throw new ApiError(400, 'INVALID_UPLOAD', 'بيانات الصورة غير صحيحة أو مفقودة.');
      const dataUrl = /^data:([^;]+);base64,(.+)$/.exec(data);
      const type = (dataUrl?.[1] || mimeType || '').toLowerCase();
      const base64 = dataUrl?.[2] || data;
      if (!TYPES[type]) throw new ApiError(400, 'UNSUPPORTED_IMAGE_TYPE', 'نوع الصورة غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.');
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) throw new ApiError(400, 'INVALID_UPLOAD', 'بيانات الصورة غير صحيحة.');
      if (buffer.length > 5 * 1024 * 1024) throw new ApiError(400, 'IMAGE_TOO_LARGE', 'حجم الصورة كبير جدًا. الحد الأقصى المسموح به هو 5 ميجابايت.');
      const valid = type === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
        : type === 'image/jpeg' ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
          : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
      if (!valid) throw new ApiError(400, 'INVALID_IMAGE', 'محتوى الملف لا يطابق نوع الصورة.');
      if (!['products', 'categories', 'offers'].includes(folder)) throw new ApiError(400, 'INVALID_UPLOAD_FOLDER', 'نوع الصورة غير صالح.');
      let asset;
      if (configured || partial || nodeEnv === 'production') {
        requireCloudinary();
        const publicId = `family_restaurant/${folder}/${crypto.randomUUID()}`;
        const uploaded = await signedRequest('upload', { public_id: publicId, overwrite: 'false' }, `data:${type};base64,${base64}`);
        asset = { imageUrl: uploaded.secure_url, imagePublicId: uploaded.public_id, imageVersion: uploaded.version };
        const parsed = storedImage(asset);
        if (asset.imagePublicId !== publicId || !Number.isSafeInteger(asset.imageVersion) || asset.imageVersion < 1
          || parsed.cloudName !== cloudinary.cloudName || !asset.imageUrl.includes(`/v${asset.imageVersion}/`)) {
          throw new ApiError(502, 'INVALID_CLOUDINARY_RESPONSE', 'لم يُرجع Cloudinary بيانات صورة صالحة. أعد المحاولة.');
        }
      } else {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const name = `img-${now()}-${crypto.randomUUID()}${TYPES[type]}`;
        await fs.promises.writeFile(path.join(uploadsDir, name), buffer);
        asset = { imageUrl: `/uploads/${name}`, imagePublicId: '', imageVersion: null };
      }
      return { ...asset, url: asset.imageUrl, imageUploadToken: issueReceipt(asset, owner) };
    },
    prepareImage(data, previous = {}, owner = '') {
      const { image, imageUrl, imagePublicId, imageVersion, imageUploadToken, ...rest } = data;
      if ([image, imageUrl, imagePublicId, imageVersion, imageUploadToken].every(value => value === undefined)) return rest;
      const previousAsset = storedImage(previous);
      const url = imageUrl ?? image ?? previousAsset.imageUrl;
      let asset;
      if (imageUploadToken) {
        asset = verifyReceipt(imageUploadToken, owner);
        if (url !== asset.imageUrl || (imagePublicId !== undefined && imagePublicId !== asset.imagePublicId)
          || (imageVersion !== undefined && imageVersion !== asset.imageVersion)) throw new ApiError(400, 'INVALID_IMAGE_UPLOAD', 'بيانات الصورة لا تطابق عملية الرفع.');
      } else if (url === previousAsset.imageUrl) {
        if (imagePublicId !== undefined && imagePublicId !== previousAsset.imagePublicId) throw new ApiError(400, 'INVALID_IMAGE_UPLOAD', 'معرّف الصورة غير صالح.');
        asset = previousAsset;
      } else {
        let safe = !url || /^\/images\/(?!.*\.\.)[^?#]+$/.test(url) || (nodeEnv !== 'production' && /^\/uploads\/img-[a-zA-Z0-9.-]+$/.test(url));
        try { const parsed = new URL(url); safe ||= nodeEnv !== 'production' && parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.hostname !== 'res.cloudinary.com'; } catch {}
        if (!safe || imagePublicId) throw new ApiError(400, 'IMAGE_UPLOAD_REQUIRED', 'ارفع الصورة من زر اختيار الصورة قبل حفظها.');
        asset = { imageUrl: url, imagePublicId: '', imageVersion: null };
      }
      return { ...rest, image: asset.imageUrl, ...imageFields(asset) };
    },
    async deleteImage(asset) {
      if (!managedId(asset.imagePublicId) || asset.cloudName !== cloudinary.cloudName) throw new Error('Image ownership mismatch');
      const deleted = await signedRequest('destroy', { public_id: asset.imagePublicId, invalidate: 'true' });
      if (!['ok', 'not found'].includes(deleted.result)) throw new Error('Image deletion not confirmed');
    },
  };
}
