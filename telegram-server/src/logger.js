export function log(scope, message, detail) {
  console.log(`[telegram-gateway:${scope}] ${message}`, detail ?? '');
}

export function logError(scope, message, error) {
  console.error(`[telegram-gateway:${scope}] ${message}`, error instanceof Error ? error.stack : error);
}