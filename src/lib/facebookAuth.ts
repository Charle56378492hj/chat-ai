// ─────────────────────────────────────────────────────────────────────────────
// ربط فيسبوك/إنستغرام بضغطة واحدة عبر Facebook Login
//
// بدل ما نطلب من التاجر يفتح Meta for Developers وينسخ Page ID وAccess Token
// يدويًا، هاد الملف بيحمّل Facebook JavaScript SDK وبيفتح نافذة تسجيل دخول
// فيسبوك الرسمية. التاجر بس بسجّل دخول وبيوافق على الصلاحيات، ومنجيب صفحاته
// تلقائيًا. تبادل التوكن لتوكن دائم وتفعيل الويبهوك عالصفحة بيصير سيرفر-سايد
// (بدالة facebook-connect) حتى ما يطلع App Secret أبدًا للمتصفح.
// ─────────────────────────────────────────────────────────────────────────────

export const FACEBOOK_APP_ID = (
  (import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined) ?? ''
).trim();

export const isFacebookLoginConfigured = () => FACEBOOK_APP_ID.length > 0;

// الصلاحيات المطلوبة: عرض الصفحات، قراءة/إرسال رسائل ماسنجر، النشر التلقائي،
// وربط حساب إنستغرام التجاري المتصل بالصفحة.
const LOGIN_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_messages',
].join(',');

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (res: FbLoginResponse) => void,
        opts: { scope: string; return_scopes?: boolean }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FbLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: { accessToken: string; userID: string; grantedScopes?: string };
}

let sdkPromise: Promise<void> | null = null;

/** يحمّل Facebook SDK مرة وحدة فقط ويهيّئه بالـ App ID. */
export function loadFacebookSdk(): Promise<void> {
  if (!isFacebookLoginConfigured()) {
    return Promise.reject(new Error('لم يتم ضبط ربط فيسبوك التلقائي بعد (VITE_FACEBOOK_APP_ID).'));
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.FB) { resolve(); return; }

    window.fbAsyncInit = () => {
      try {
        window.FB!.init({
          appId: FACEBOOK_APP_ID,
          xfbml: false,
          version: 'v21.0',
        });
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error('تعذّر تهيئة Facebook SDK'));
      }
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return; // بينفّذ fbAsyncInit لما يخلص التحميل

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/ar_AR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('تعذّر تحميل Facebook SDK. تحقق من الاتصال بالإنترنت.'));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/** يفتح نافذة تسجيل الدخول الرسمية ويرجّع توكن مستخدم قصير الأمد. */
export async function facebookLogin(): Promise<{ accessToken: string; userId: string }> {
  await loadFacebookSdk();
  return new Promise((resolve, reject) => {
    window.FB!.login(
      (res) => {
        if (res.status === 'connected' && res.authResponse) {
          resolve({ accessToken: res.authResponse.accessToken, userId: res.authResponse.userID });
        } else if (res.status === 'not_authorized') {
          reject(new Error('تم رفض الصلاحيات المطلوبة. لازم توافق عليها حتى نقدر نربط صفحتك.'));
        } else {
          reject(new Error('تم إلغاء تسجيل الدخول.'));
        }
      },
      { scope: LOGIN_SCOPES, return_scopes: true }
    );
  });
}

export interface FbPage {
  id: string;
  name: string;
  category?: string;
}

/** يجيب لائحة صفحات فيسبوك يديرها المستخدم (اسم ورقم فقط — بدون توكنات). */
export async function fetchManagedPages(userAccessToken: string): Promise<FbPage[]> {
  const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category&limit=100&access_token=${encodeURIComponent(userAccessToken)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const msg = data?.error?.message as string | undefined;
    throw new Error(msg ?? 'تعذّر جلب صفحات فيسبوك. حاول مجددًا.');
  }
  return (data.data ?? []) as FbPage[];
}
