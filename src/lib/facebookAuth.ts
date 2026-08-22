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

// تسجيل تفصيلي بكل خطوة — يظهر بكونسول المتصفح (F12) مع بادئة [fbAuth]، حتى
// نقدر نشوف بالضبط وين بتتوقف العملية إذا صار خلل صامت بدون رسالة خطأ.
function log(step: string, detail?: unknown) {
  if (detail === undefined) console.log(`[fbAuth] ${step}`);
  else console.log(`[fbAuth] ${step}:`, detail);
}

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
// نتتبّع التهيئة الفعلية بأنفسنا بدل الاعتماد على window.FB وحده — لأنو
// window.FB بينخلق فور ما سكربت فيسبوك يبلّش يتفسّر، قبل ما FB.init() يشتغل
// فعليًا جوا fbAsyncInit. الاعتماد على "if (window.FB)" وحده كان يخلّي
// الكود يظن إنو التهيئة خلصت وهي لسا ما بلّشت، فيصير FB.login() قبل init().
let fbInitialized = false;

/** يحمّل Facebook SDK مرة وحدة فقط ويهيّئه بالـ App ID. */
export function loadFacebookSdk(): Promise<void> {
  log('loadFacebookSdk() called', { appId: FACEBOOK_APP_ID, fbInitialized, hasWindowFB: Boolean(window.FB) });

  if (!isFacebookLoginConfigured()) {
    log('ERROR: VITE_FACEBOOK_APP_ID غير مضبوط بالفرونت إند');
    return Promise.reject(new Error('لم يتم ضبط ربط فيسبوك التلقائي بعد (VITE_FACEBOOK_APP_ID).'));
  }
  if (fbInitialized) {
    log('SDK مهيّأ من قبل، منرجع فورًا');
    return Promise.resolve();
  }
  if (sdkPromise) {
    log('في تحميل جاري بالفعل، منرجع نفس الـ promise');
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const finishInit = () => {
      log('finishInit() بلّش — عم نستدعي FB.init()');
      try {
        window.FB!.init({
          appId: FACEBOOK_APP_ID,
          xfbml: false,
          version: 'v21.0',
        });
        fbInitialized = true;
        log('FB.init() نجح ✅');
        resolve();
      } catch (e) {
        log('ERROR: FB.init() رمى استثناء', e);
        sdkPromise = null; // نسمح بإعادة المحاولة لاحقًا
        reject(e instanceof Error ? e : new Error('تعذّر تهيئة Facebook SDK'));
      }
    };

    // إذا السكربت محمّل من قبل (window.FB موجود) بس لسا ما استدعينا init
    // بنفسنا، نبادر نهيّئه هلق بدل ما ننتظر fbAsyncInit يلي ما رح يُستدعى
    // تاني (فيسبوك بيستدعيه مرة وحدة بس عند أول تحميل للسكربت).
    if (window.FB) {
      log('window.FB موجود من قبل، عم نهيّئ فورًا بدون تحميل سكربت جديد');
      finishInit();
      return;
    }

    window.fbAsyncInit = finishInit;

    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      log('تاغ السكربت موجود من قبل بالصفحة، منستنى fbAsyncInit يشتغل لحاله');
      return; // بينفّذ fbAsyncInit لما يخلص التحميل
    }

    log('عم ننشئ ونضيف تاغ سكربت facebook-jssdk جديد');

    // مهلة أمان: إذا السكربت ما حمّل خلال ١٥ ثانية (حجب إعلانات، تقييد شبكة،
    // إلخ) منرفض بدل ما نضل معلّقين للأبد وكأنو "ما عم يصير اي شي".
    const timeout = setTimeout(() => {
      log('ERROR: مهلة تحميل السكربت (15 ثانية) خلصت بدون ما يحمّل السكربت');
      sdkPromise = null;
      reject(new Error('تعذّر تحميل Facebook SDK خلال وقت معقول. تحقق من اتصالك بالإنترنت أو عطّل أي أداة حجب إعلانات وحاول مجددًا.'));
    }, 15_000);

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/ar_AR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      log('script.onload أطلق — السكربت وصل وتفسّر، منستنى fbAsyncInit يشتغل');
      clearTimeout(timeout);
    };
    script.onerror = (ev) => {
      log('ERROR: script.onerror أطلق — فشل تحميل السكربت من الشبكة', ev);
      clearTimeout(timeout);
      sdkPromise = null;
      reject(new Error('تعذّر تحميل Facebook SDK. تحقق من الاتصال بالإنترنت أو عطّل أداة حجب الإعلانات.'));
    };
    document.body.appendChild(script);
    log('تاغ السكربت انضاف للصفحة، عم ننتظر التحميل...');
  });

  return sdkPromise;
}

/** يفتح نافذة تسجيل الدخول الرسمية ويرجّع توكن مستخدم قصير الأمد. */
export async function facebookLogin(): Promise<{ accessToken: string; userId: string }> {
  log('facebookLogin() بلّش');
  await loadFacebookSdk();
  log('loadFacebookSdk() خلص، عم نتحقق من الحالة', { fbInitialized, hasWindowFB: Boolean(window.FB) });

  if (!fbInitialized || !window.FB) {
    log('ERROR: SDK مش مهيّأ رغم إنو loadFacebookSdk خلص بدون خطأ — حالة غير متوقعة');
    throw new Error('لم تكتمل تهيئة Facebook SDK بعد. حاول مجددًا خلال لحظات.');
  }

  log('عم نستدعي FB.login() هلق مع الصلاحيات', LOGIN_SCOPES);

  return new Promise((resolve, reject) => {
    // مهلة أمان: لو نافذة تسجيل الدخول انحظرت بصمت من المتصفح (popup blocker)،
    // FB.login() ما بترجّع ولا نداء أبدًا — بدون هاي المهلة كان المستخدم
    // بضل يتفرج عالزر يدور للأبد بلا أي تفسير.
    const timeout = setTimeout(() => {
      log('ERROR: مهلة FB.login() (30 ثانية) خلصت بدون أي رد من فيسبوك — غالبًا popup محظور أو التطبيق بوضع Development وحسابك مش Admin/Tester');
      reject(new Error('لم تفتح نافذة تسجيل الدخول أو لم تُغلق أبدًا. تأكد أن متصفحك لا يحظر النوافذ المنبثقة (popup) لهذا الموقع، وأن حسابك مضاف كـ Admin/Developer/Tester على تطبيق فيسبوك إذا كان لا يزال بوضع Development، ثم حاول مجددًا.'));
    }, 30_000);

    try {
      window.FB!.login(
        (res) => {
          clearTimeout(timeout);
          log('FB.login() رجّع رد ✅ — هاد الرد الكامل:', res);
          if (res.status === 'connected' && res.authResponse) {
            log('تسجيل الدخول نجح، عم نرجّع التوكن للواجهة');
            resolve({ accessToken: res.authResponse.accessToken, userId: res.authResponse.userID });
          } else if (res.status === 'not_authorized') {
            log('المستخدم رفض الصلاحيات المطلوبة');
            reject(new Error('تم رفض الصلاحيات المطلوبة. لازم توافق عليها حتى نقدر نربط صفحتك.'));
          } else {
            log('حالة غير معروفة أو المستخدم أغلق النافذة', res.status);
            reject(new Error('تم إلغاء تسجيل الدخول.'));
          }
        },
        { scope: LOGIN_SCOPES, return_scopes: true }
      );
      log('نداء FB.login() نُفّذ بدون استثناء، عم ننتظر الرد أو المهلة...');
    } catch (e) {
      clearTimeout(timeout);
      log('ERROR: FB.login() رمى استثناء بشكل متزامن (نادر جدًا)', e);
      reject(e instanceof Error ? e : new Error('حدث خطأ غير متوقع أثناء استدعاء تسجيل الدخول.'));
    }
  });
}

export interface FbPage {
  id: string;
  name: string;
  category?: string;
}

/** يجيب لائحة صفحات فيسبوك يديرها المستخدم (اسم ورقم فقط — بدون توكنات). */
export async function fetchManagedPages(userAccessToken: string): Promise<FbPage[]> {
  log('fetchManagedPages() بلّش');
  const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category&limit=100&access_token=${encodeURIComponent(userAccessToken)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  log('رد Graph API على /me/accounts', { status: res.status, data });
  if (!res.ok || !data) {
    const msg = data?.error?.message as string | undefined;
    log('ERROR: فشل جلب الصفحات', msg);
    throw new Error(msg ?? 'تعذّر جلب صفحات فيسبوك. حاول مجددًا.');
  }
  const pages = (data.data ?? []) as FbPage[];
  log(`تم جلب ${pages.length} صفحة`, pages.map((p) => p.name));
  return pages;
}
