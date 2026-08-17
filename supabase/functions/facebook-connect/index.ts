// supabase/functions/facebook-connect/index.ts
//
// يكمّل ربط ماسنجر/إنستغرام "بضغطة واحدة" بعد ما التاجر يسجّل دخول بفيسبوك
// من المتصفح (عبر src/lib/facebookAuth.ts) ويختار صفحته.
//
// ليش هاي الدالة موجودة؟
// المتصفح بس يقدر ياخد توكن مستخدم قصير الأمد (ساعة-ساعتين) من Facebook Login.
// تحويله لتوكن صفحة دائم، وتفعيل استقبال رسائل الصفحة (subscribed_apps)، لازم
// يصير من سيرفر لأنو بده App Secret تبع تطبيق فيسبوك — وهاد سر ما لازم يوصل
// أبدًا للمتصفح. فالمتصفح بيبعت التوكن القصير + رقم الصفحة المختارة لهون،
// وهون منسوّي التبادل والتفعيل ومنرجّع توكن الصفحة الدائم حتى يُخزّن بجدول
// channels متل باقي طرق الربط (يدوي أو QR).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface ConnectBody {
  user_access_token: string;
  page_id: string;
  channel_type: 'messenger' | 'instagram';
}

type Result =
  | {
      page_id: string;
      page_name: string;
      page_access_token: string;
      ig_id?: string;
      ig_username?: string;
      subscribed: boolean;
    }
  | { error: string };

function jsonResponse(body: Result, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function graphErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  return fallback;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'الطريقة غير مدعومة.' }, 405);

  const appId = Deno.env.get('FACEBOOK_APP_ID');
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    return jsonResponse(
      { error: 'ربط فيسبوك التلقائي غير مضبوط على الخادم بعد. أضف FACEBOOK_APP_ID وFACEBOOK_APP_SECRET كأسرار على Supabase.' },
      500
    );
  }

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'جسم الطلب غير صالح.' }, 400);
  }

  const { user_access_token: userToken, page_id: pageId, channel_type: channelType } = body;
  if (!userToken || !pageId) {
    return jsonResponse({ error: 'بيانات ناقصة: التوكن أو رقم الصفحة.' }, 400);
  }

  try {
    // 1) نبدّل توكن المستخدم القصير بتوكن طويل الأمد (~60 يوم، ويتجدّد كل ما
    //    يستخدم التاجر التطبيق). من هاد التوكن الطويل منقدر نطلع توكن صفحة دائم.
    const exchangeUrl =
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(userToken)}`;
    const exchangeRes = await fetch(exchangeUrl);
    const exchangeData = await exchangeRes.json().catch(() => null);
    if (!exchangeRes.ok || !exchangeData?.access_token) {
      return jsonResponse({ error: graphErrorMessage(exchangeData, 'فشل تبديل توكن الدخول. حاول تسجيل الدخول من جديد.') }, 400);
    }
    const longLivedUserToken = exchangeData.access_token as string;

    // 2) نجيب توكن الصفحة (بيطلع دائم تلقائيًا لما يُشتق من توكن مستخدم طويل الأمد).
    const pagesUrl = `${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(longLivedUserToken)}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json().catch(() => null);
    if (!pagesRes.ok || !pagesData?.data) {
      return jsonResponse({ error: graphErrorMessage(pagesData, 'تعذّر جلب صفحات فيسبوك.') }, 400);
    }
    const page = (pagesData.data as { id: string; name: string; access_token: string }[]).find(
      (p) => p.id === pageId
    );
    if (!page) {
      return jsonResponse({ error: 'الصفحة المختارة غير موجودة ضمن صفحاتك، أو تم سحب الصلاحية.' }, 400);
    }

    // 3) نفعّل استقبال الأحداث عالصفحة (رسائل ماسنجر + منشورات) حتى الويبهوك
    //    يشتغل فورًا بدون أي إعداد يدوي إضافي من التاجر.
    const subscribeFields =
      channelType === 'instagram'
        ? 'messages,messaging_postbacks,feed'
        : 'messages,messaging_postbacks,message_deliveries,messaging_optins,feed';
    const subscribeUrl =
      `${GRAPH}/${page.id}/subscribed_apps?subscribed_fields=${encodeURIComponent(subscribeFields)}` +
      `&access_token=${encodeURIComponent(page.access_token)}`;
    const subscribeRes = await fetch(subscribeUrl, { method: 'POST' });
    const subscribeData = await subscribeRes.json().catch(() => null);
    const subscribed = Boolean(subscribeRes.ok && subscribeData?.success);

    // 4) لإنستغرام: لازم يكون فيه حساب إنستغرام تجاري مربوط بنفس صفحة فيسبوك.
    let igId: string | undefined;
    let igUsername: string | undefined;
    if (channelType === 'instagram') {
      const igUrl = `${GRAPH}/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`;
      const igRes = await fetch(igUrl);
      const igData = await igRes.json().catch(() => null);
      const igAccount = igData?.instagram_business_account as { id?: string; username?: string } | undefined;
      if (!igAccount?.id) {
        return jsonResponse(
          { error: 'ما في حساب إنستغرام تجاري مربوط بهاي الصفحة. اربط حساب إنستغرام بصفحتك من إعدادات فيسبوك أولًا.' },
          400
        );
      }
      igId = igAccount.id;
      igUsername = igAccount.username;
    }

    return jsonResponse({
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      ig_id: igId,
      ig_username: igUsername,
      subscribed,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'خطأ غير متوقع أثناء الربط.' }, 500);
  }
});
