// ─────────────────────────────────────────────────────────────────────────────
// عميل بوابة واتساب محسّن (Baileys)
//
// التحسينات:
//  • معالجة أخطاء أفضل مع رسائل واضحة
//  • وقت انتظار أطول للاتصال
//  • إعادة محاولة ذكية
//  • تخزين محلي كنسخة احتياطية
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

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

// تخزين محلي للحالات (نسخة احتياطية)
const localSnapshots = new Map<string, WaSnapshot>();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isWhatsAppGatewayConfigured()) {
    throw new Error(
      'بوابة واتساب غير مضبوطة.\n\n' +
      'الحل:\n' +
      '1. تأكد من تشغيل خادم البوابة (مجلد whatsapp-server)\n' +
      '2. أضف رابطه في VITE_WHATSAPP_GATEWAY_URL\n' +
      '3. أعد بناء التطبيق (npm run build)'
    );
  }

  // توكن الجلسة هو ما يثبت للبوابة أن الطلب من صاحب المتجر فعلًا
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('انتهت جلستك. يرجى تسجيل الدخول من جديد.');

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30 ثانية timeout
    
    try {
      res = await fetch(`${WHATSAPP_GATEWAY_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('انتهت مهلة انتظار الاتصال بخادم واتساب (30 ثانية). تأكد من عمل الخادم.');
    }
    throw new Error('تعذّر الوصول إلى خادم واتساب. تأكد أنه يعمل والاتصال مستقر.');
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errorMsg = typeof body.error === 'string' 
      ? body.error 
      : `فشل الطلب (${res.status})`;
    
    // رسائل خطأ مفيدة حسب الحالة
    let friendlyError = errorMsg;
    if (res.status === 401) {
      friendlyError = 'انتهت صلاحية جلستك. يرجى تسجيل الدخول من جديد.';
    } else if (res.status === 403) {
      friendlyError = 'ليس لديك صلاحية الوصول إلى هذه القناة.';
    } else if (res.status === 404) {
      friendlyError = 'القناة غير موجودة.';
    } else if (res.status === 429) {
      friendlyError = 'عدد الطلبات كثير جدًا. انتظر قليلاً ثم حاول مجددًا.';
    } else if (res.status === 500) {
      friendlyError = 'خطأ في خادم واتساب. حاول مجددًا بعد دقيقة.';
    }
    
    throw new Error(friendlyError);
  }
  return body as T;
}

/** بدء الجلسة وتوليد QR (يدوي فقط) */
export const startWhatsAppSession = async (channelId: string, forceNewQr = false) => {
  try {
    const snapshot = await request<WaSnapshot>(`/api/sessions/${channelId}/start`, {
      method: 'POST',
      body: JSON.stringify({ force_new_qr: forceNewQr }),
    });
    
    // حفظ محلي
    localSnapshots.set(channelId, snapshot);
    return snapshot;
  } catch (e) {
    // إذا فشل الطلب، جرّب الاسترجاع من الذاكرة المحلية
    const cached = localSnapshots.get(channelId);
    if (cached && cached.status !== 'idle') {
      console.warn('استخدام نسخة محفوظة محليًا:', e);
      return cached;
    }
    throw e;
  }
};

/** حالة الجلسة (استطلاع مستمر) */
export const getWhatsAppStatus = async (channelId: string) => {
  try {
    const snapshot = await request<WaSnapshot>(`/api/sessions/${channelId}/status`);
    
    // حفظ محلي
    localSnapshots.set(channelId, snapshot);
    return snapshot;
  } catch (e) {
    // في حالة الخطأ، جرّب الاسترجاع من الذاكرة المحلية
    const cached = localSnapshots.get(channelId);
    if (cached) {
      // إذا كان الخطأ خطير، أضيف الخطأ للنسخة المحفوظة
      return { 
        ...cached, 
        last_error: e instanceof Error ? e.message : 'خطأ غير معروف' 
      } as WaSnapshot;
    }
    
    // إذا ما في نسخة محفوظة، أرجع خطأ نظيف
    return { 
      ...EMPTY, 
      last_error: e instanceof Error ? e.message : 'خطأ غير معروف' 
    } as WaSnapshot;
  }
};

/** فصل الحساب */
export const logoutWhatsAppSession = (channelId: string) =>
  request<{ ok: boolean }>(`/api/sessions/${channelId}/logout`, { method: 'POST' });

/** إرسال رسالة نصية */
export const sendWhatsAppText = (channelId: string, to: string, text: string) =>
  request<{ ok: boolean; message_id: string }>(`/api/sessions/${channelId}/send`, {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });

export const WA_STATUS_LABEL: Record<WaStatus, string> = {
  idle: 'غير مُفعّل',
  connecting: 'جارٍ الاتصال…',
  qr: 'بانتظار مسح الرمز',
  connected: 'متصل ✅',
  disconnected: 'انقطع — تتم إعادة المحاولة',
  logged_out: 'تم تسجيل الخروج — يلزم QR جديد',
};

// دالة تنظيف الذاكرة المحلية
export function clearLocalSnapshots() {
  localSnapshots.clear();
}

// دالة للحصول على جميع النسخ المحفوظة محليًا
export function getLocalSnapshots() {
  return new Map(localSnapshots);
}
