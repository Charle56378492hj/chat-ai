import pino from 'pino';

// baileys يطلب logger متوافق مع pino. نخلي مستواه هادي حتى ما يغرق السجلات،
// بينما سجلاتنا نحن (log) تبقى واضحة ومفيدة للتشخيص.
export const waLogger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });

export function log(scope, message, detail) {
  const time = new Date().toISOString();
  if (detail === undefined) console.log(`[${time}] [${scope}] ${message}`);
  else console.log(`[${time}] [${scope}] ${message}:`, typeof detail === 'string' ? detail : JSON.stringify(detail));
}

export function logError(scope, message, error) {
  const time = new Date().toISOString();
  const detail = error instanceof Error ? `${error.message}` : JSON.stringify(error ?? null);
  console.error(`[${time}] [${scope}] ❌ ${message}: ${detail}`);
}
