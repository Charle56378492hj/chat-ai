import 'dotenv/config';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[env] المتغير المطلوب ${name} غير مضبوط`);
  return value;
}

function encryptionKey(value) {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('[env] TELEGRAM_SESSION_ENCRYPTION_KEY يجب أن يكون 32 بايت (64 hex أو base64)');
}

export const env = {
  port: Number(process.env.PORT || 8090),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  telegramApiId: Number(required('TELEGRAM_API_ID')),
  telegramApiHash: required('TELEGRAM_API_HASH'),
  sessionEncryptionKey: encryptionKey(required('TELEGRAM_SESSION_ENCRYPTION_KEY')),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean),
};

if (!Number.isInteger(env.telegramApiId) || env.telegramApiId <= 0) {
  throw new Error('[env] TELEGRAM_API_ID غير صالح');
}