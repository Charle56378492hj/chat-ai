import { supabase } from './supabase';

export type TelegramStatus =
  | 'idle'
  | 'starting'
  | 'qr'
  | 'connecting'
  | 'password_required'
  | 'connected'
  | 'error'
  | 'logged_out';

export interface TelegramSnapshot {
  channel_id: string;
  status: TelegramStatus;
  qr_value: string | null;
  qr_image: string | null;
  qr_expires_at: string | null;
  phone: string | null;
  username: string | null;
  display_name: string | null;
  last_error: string | null;
  connected_at: string | null;
}

export const TG_STATUS_LABEL: Record<TelegramStatus, string> = {
  idle: 'جاهز',
  starting: 'جارٍ تجهيز الجلسة…',
  qr: 'في انتظار مسح QR من تطبيق تيليغرام…',
  connecting: 'تم المسح — جارٍ اعتماد الحساب…',
  password_required: 'الحساب محمي بخطوتين — أدخل كلمة مرور تيليغرام',
  connected: 'الحساب متصل',
  error: 'حدث خطأ',
  logged_out: 'تم تسجيل الخروج',
};

const gatewayUrl = (import.meta.env.VITE_TELEGRAM_GATEWAY_URL as string | undefined)?.replace(/\/+$/, '');

export function isTelegramGatewayConfigured(): boolean {
  return Boolean(gatewayUrl);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!gatewayUrl) {
    throw new Error('بوابة تيليغرام غير مضبوطة. أضف VITE_TELEGRAM_GATEWAY_URL إلى متغيرات الواجهة.');
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('جلسة الدخول منتهية. سجّل الدخول مجددًا.');

  const response = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error ?? 'تعذّر الاتصال ببوابة تيليغرام');
  return body as T;
}

export const startTelegramSession = (channelId: string, forceNewQr = false) =>
  request<TelegramSnapshot>(`/api/telegram/sessions/${channelId}/start`, {
    method: 'POST',
    body: JSON.stringify({ force_new_qr: forceNewQr }),
  });

export const getTelegramStatus = (channelId: string) =>
  request<TelegramSnapshot>(`/api/telegram/sessions/${channelId}/status`);

export const logoutTelegramSession = (channelId: string) =>
  request<{ ok: true }>(`/api/telegram/sessions/${channelId}/logout`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const submitTelegramPassword = (channelId: string, password: string) =>
  request<{ ok: true }>(`/api/telegram/sessions/${channelId}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

export const sendTelegramText = (channelId: string, to: string, text: string) =>
  request<{ ok: true; message_id: string }>(`/api/telegram/sessions/${channelId}/send`, {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });

export const publishTelegramText = (channelId: string, to: string, text: string) =>
  request<{ ok: true; message_id: string }>(`/api/telegram/sessions/${channelId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });