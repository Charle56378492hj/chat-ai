// إعدادات البيئة — نتحقق منها عند الإقلاع بدل ما نكتشف النقص وقت أول ربط.
function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`[env] المتغير المطلوب ${name} غير مضبوط. راجع whatsapp-server/.env.example`);
    process.exit(1);
  }
  return value.trim();
}

export const env = {
  port: Number(process.env.PORT || 8088),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  gatewaySecret: required('WHATSAPP_GATEWAY_SECRET'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
