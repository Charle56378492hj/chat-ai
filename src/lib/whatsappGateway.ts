// ─────────────────────────────────────────────────────────────────────────────
// عميل بوابة واتساب (Baileys)
//
// البوابة سيرفر Node مستقل (مجلد whatsapp-server) لأن بروتوكول واتساب Web
// بدّو اتصال WebSocket دائم وتشفير إشارات — مستحيل ينعمل من المتصفح.
// كل طلب منبعتو محمّل بتوكن جلسة Supabase تبع المستخدم، والبوابة بتتأكد إنو
// المستخدم فعلًا عضو بالمتجر صاحب القناة قبل ما تعطيه QR أو تفصل جلسة.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

/** رابط البوابة — يُضبط عبر VITE_WHATSAPP_GATEWAY_URL في ملف البيئة. */
export const WHATSAPP_GATEWAY_URL = (
  (import.meta.env.VITE_WHATSAPP_GATEWAY_URL as string | undefined) ?? ''
).replace(/\/+$/, '');

export const isWhatsAppGatewayConfigured = () => WHATSAPP_GATEWAY_URL.length > 0;

export type WaStatus =
  | 'idle'
  | 'connecting'
  | 'qr'
  | 'connected'
  | 'disconnected'
  | 'logged_out';

export interface WaSnapshot {
  status: WaStatus;
  qr: string | null;
  qr_image: string | null;
  qr_expires_at: string | null;
  phone: string | null;
  last_error: string | null;
  reconnect_attempts?: number;
}

const EMPTY: WaSnapshot = {
  status: 'idle',
  qr: null,
  qr_image: null,
  qr_expires_at: null,
  phone: null,
  last_error: null,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isWhatsAppGatewayConfigured()) {
    throw new Error('بوابة واتساب غير مضبوطة. أضف VITE_WHATSAPP_GATEWAY_URL ثم أعد بناء التطبيق.');
  }

  // توكن الجلسة هو ما يثبت للبوابة أن الطلب من صاحب المتجر فعلًا.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('انتهت جلستك. يرجى تسجيل الدخول من جديد.');

  let res: Response;
  try {
    res = await fetch(`${WHATSAPP_GATEWAY_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('تعذّر الوصول إلى خادم واتساب. تأكد أنه يعمل وأن الرابط صحيح.');
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) || `فشل الطلب (${res.status})`);
  }
  return body as T;
}

/** بدء الجلسة وتوليد QR. force = كود جديد بدل استئناف جلسة قديمة. */
export const startWhatsAppSession = (channelId: string, forceNewQr = false) =>
  request<WaSnapshot>(`/api/sessions/${channelId}/start`, {
    method: 'POST',
    body: JSON.stringify({ force_new_qr: forceNewQr }),
  });

/** حالة الجلسة الحالية (نستدعيها كل ثانيتين أثناء عرض الـ QR). */
export const getWhatsAppStatus = (channelId: string) =>
  request<WaSnapshot>(`/api/sessions/${channelId}/status`).catch((e) => {
    // أثناء الاستطلاع، خطأ شبكة عابر ما لازم يوقف كل شي.
    return { ...EMPTY, last_error: e instanceof Error ? e.message : 'خطأ غير معروف' } as WaSnapshot;
  });

/** فصل الحساب ومسح الجلسة المخزّنة (يتطلب مسح QR جديد بعدها). */
export const logoutWhatsAppSession = (channelId: string) =>
  request<{ ok: boolean }>(`/api/sessions/${channelId}/logout`, { method: 'POST' });

/** إرسال رسالة نصية من لوحة التحكم. */
export const sendWhatsAppText = (channelId: string, to: string, text: string) =>
  request<{ ok: boolean; message_id: string }>(`/api/sessions/${channelId}/send`, {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });

export const WA_STATUS_LABEL: Record<WaStatus, string> = {
  idle: 'غير مُفعّل',
  connecting: 'جارٍ الاتصال…',
  qr: 'بانتظار مسح الرمز',
  connected: 'متصل',
  disconnected: 'انقطع — تتم إعادة المحاولة',
  logged_out: 'تم تسجيل الخروج — يلزم مسح QR جديد',
};
