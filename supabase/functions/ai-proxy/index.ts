// supabase/functions/ai-proxy/index.ts
//
// بروكسي سيرفر-سايد لاستدعاء مزوّدي الذكاء الاصطناعي (OpenAI / OpenRouter / Google / Hugging Face).
//
// ليش هذه الدالة موجودة؟
// المتصفح كان يستدعي مزوّد الذكاء الاصطناعي (مثلاً openrouter.ai) مباشرة من جهاز المستخدم.
// كثير من هالمزودين (وشبكات CDN متل Cloudflare يلي يقفوا وراها) يحظروا الاتصال المباشر
// القادم من بعض الدول (عقوبات/قيود جغرافية)، فالطلب يفشل فورًا بخطأ شبكة/CORS عام
// قبل ما يوصل حتى لسيرفر المزوّد. لما تجرب بنفس الجهاز عبر بروكسي (زي ما عم تعمل بالـ curl)
// الطلب بينطلق من IP مختلف فينجح.
//
// الحل: تنفيذ الطلب من سيرفرات Supabase Edge Functions (يلي عادةً مو محظورة) بدل متصفح المستخدم.
// هيك المتصفح بس بيبعت طلب لـ Supabase (اللي شغال أساسًا بالمشروع)، وSupabase هو يلي
// بيتواصل مع OpenAI/OpenRouter/Google/Hugging Face وبيرجع الرد.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatBody = {
  action?: 'chat';
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userMessage: string;
};

type ModelsBody = {
  action: 'models';
  provider: string;
  apiKey: string;
};

type ProxyResult =
  | { content: string }
  | { models: string[] }
  | { error: string };

function jsonResponse(body: ProxyResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const errVal = (data as { error: unknown }).error;
    if (typeof errVal === 'string') return errVal;
    if (errVal && typeof errVal === 'object' && 'message' in errVal) {
      const m = (errVal as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
  }
  return fallback;
}

async function callChat(body: ChatBody): Promise<ProxyResult> {
  const { provider, apiKey, model, systemPrompt, userMessage } = body;

  if (!apiKey) return { error: 'مفتاح API مفقود.' };
  if (!model) return { error: 'اسم النموذج مفقود.' };

  const messages = [
    { role: 'system', content: systemPrompt ?? '' },
    { role: 'user', content: userMessage ?? '' },
  ];

  let endpoint = '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const reqBody: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 300,
    temperature: 0.7,
  };

  if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://supabase.co';
    // ملاحظة: هيدرز HTTP لازم تكون ASCII بس (ByteString) — نص عربي هون كان يكسر fetch فورًا
    // بخطأ "not a valid ByteString"، وهذا كان السبب الحقيقي وراء فشل الاتصال بالكامل.
    headers['X-Title'] = 'Auto Reply Bot';
  } else if (provider === 'google') {
    endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'huggingface') {
    endpoint = 'https://router.huggingface.co/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    return { error: `مزوّد غير معروف: ${provider}` };
  }

  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(reqBody) });
  } catch {
    return { error: 'تعذّر السيرفر من الاتصال بمزوّد الذكاء الاصطناعي. حاول مجددًا بعد قليل.' };
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { error: extractErrorMessage(data, `فشل الطلب (HTTP ${res.status})`) };
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    return { error: extractErrorMessage(data, 'خطأ من المزوّد') };
  }

  const content = (data as { choices?: { message?: { content?: string } }[] } | null)
    ?.choices?.[0]?.message?.content;

  return { content: content ?? 'لم أحصل على رد من المزوّد.' };
}

async function callModels(body: ModelsBody): Promise<ProxyResult> {
  const { provider, apiKey } = body;
  if (!apiKey) return { error: 'أدخل مفتاح API أولًا قبل جلب النماذج.' };

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: extractErrorMessage(data, `فشل الطلب (HTTP ${res.status})`) };
      const ids = ((data?.data ?? []) as { id: string }[]).map((m) => m.id);
      return { models: ids.filter((id) => /^(gpt|o[1-9])/i.test(id)).sort() };
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: extractErrorMessage(data, `فشل الطلب (HTTP ${res.status})`) };
      const ids = ((data?.data ?? []) as { id: string }[]).map((m) => m.id);
      return { models: ids.sort() };
    }

    if (provider === 'google') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: extractErrorMessage(data, `فشل الطلب (HTTP ${res.status})`) };
      const models = (data?.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[];
      return {
        models: models
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''))
          .sort(),
      };
    }

    if (provider === 'huggingface') {
      return { error: 'جلب النماذج تلقائيًا غير متاح لـ Hugging Face — اكتب اسم الموديل يدويًا في حقل النموذج.' };
    }

    return { error: `مزوّد غير معروف: ${provider}` };
  } catch {
    return { error: 'تعذّر السيرفر من الاتصال بمزوّد الذكاء الاصطناعي. حاول مجددًا بعد قليل.' };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'الطريقة غير مدعومة.' }, 405);
  }

  let parsed: ChatBody | ModelsBody;
  try {
    parsed = await req.json();
  } catch {
    return jsonResponse({ error: 'جسم الطلب غير صالح.' }, 400);
  }

  // ملاحظة مهمة: نرجّع دايمًا HTTP 200 حتى لو في خطأ تطبيقي (مفتاح غلط، موديل غير موجود...).
  // لأنو مكتبة supabase-js بتعتبر أي status غير 2xx "خطأ استدعاء" (invoke error) وبتخفي
  // محتوى الـ body الحقيقي عن الواجهة الأمامية. فبنفرّق بين "خطأ بالمزوّد" (نحطه بحقل error
  // جوا body مع status 200) و"عطل حقيقي بالدالة نفسها" (500 — قبل ما توصل لهون أصلًا).
  const result =
    parsed.action === 'models' ? await callModels(parsed) : await callChat(parsed as ChatBody);

  return jsonResponse(result, 200);
});
