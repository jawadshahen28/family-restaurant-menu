import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { buildAllowedOrigins } from './origins.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGIN: z.string().min(1),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  DEV_CLIENT_ORIGINS: z.string().default(''),
  DEV_CLIENT_PORTS: z.string().default('5173,5174'),
  DEV_ALLOW_LAN: z.enum(['true', 'false']).default('true'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@family-restaurant.local'),
});

export function validateEnvironment(source) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) throw new Error('إعدادات الخادم ناقصة أو غير صحيحة. راجع server/.env دون مشاركة بيانات الاتصال.');
  const env = parsed.data;
  try {
    const uri = new URL(env.MONGODB_URI);
    if (uri.protocol !== 'mongodb+srv:' || uri.hostname !== 'cluster0.b5zqh3z.mongodb.net'
      || decodeURIComponent(uri.username) !== 'family_menu' || uri.pathname !== '/family_menu'
      || !uri.password || ['REPLACE_WITH_PASSWORD', 'CHANGEME', 'PASSWORD'].includes(decodeURIComponent(uri.password).toUpperCase())) throw new Error();
  } catch { throw new Error('إعداد MongoDB غير صالح. استبدل كلمة المرور النائبة في server/.env واستخدم قاعدة family_menu والمستخدم والمضيف المحددين.'); }
  const allowedOrigins = buildAllowedOrigins({ clientOrigin: env.CLIENT_ORIGIN, nodeEnv: env.NODE_ENV, devClientOrigins: env.DEV_CLIENT_ORIGINS, devClientPorts: env.DEV_CLIENT_PORTS, devAllowLan: env.DEV_ALLOW_LAN === 'true' });
  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    mongoUri: env.MONGODB_URI,
    databaseName: 'family_menu',
    allowedOrigins,
    trustProxy: env.TRUST_PROXY,
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
  };
}

export function loadEnvironment() {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
  return validateEnvironment(process.env);
}
