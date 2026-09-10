// supabase/functions/ai-agent-chat/index.ts
//
// "دماغ" AI Command Center: يستقبل رسالة التاجر، يعطيها لنموذج الذكاء
// الاصطناعي المهيّأ فعلاً بالمتجر (نفس إعدادات AI Studio) مع تعريف أدوات
// حقيقية (view_orders, send_message, create_schedule...)، ينفذ أي أداة
// يطلبها النموذج بشكل محصور بصلاحيات التاجر صاحب الجلسة، ثم يعيد للنموذج
// نتيجة التنفيذ الحقيقية ليصوغ رداً نهائياً بالعربية.
//
// كل هذا يحدث على الخادم (Supabase Edge Function) — المفتاح لا يغادر
// الخادم أبداً، ولا يوجد وصول مباشر وغير محدود لقاعدة البيانات: كل أداة
// معرّفة بدقة في _shared/agentCore.ts وتُنفَّذ بشرط merchant_id = صاحب
// الجلسة الحالي فقط.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  AGENT_TOOLS, authToken, executeAgentTool, isReadOnlyTool, logAgentAction, merchantForUser,
  type Json,
} from '../_shared/agentCore.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_TOOL_ITERATIONS = 5;
const HISTORY_MESSAGES = 16;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400) { return json({ ok: false, error: message }, status); }

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: unknown[] }
  | { role: 'tool'; content: string; tool_call_id: string };

function providerEndpoint(provider: string): { endpoint: string; extraHeaders?: Record<string, string> } {
  switch (provider) {
    case 'openai': return { endpoint: 'https://api.openai.com/v1/chat/completions' };
    case 'openrouter': return { endpoint: 'https://openrouter.ai/api/v1/chat/completions', extraHeaders: { 'HTTP-Referer': 'https://supabase.co', 'X-Title': 'AI Command Center' } };
    case 'google': return { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' };
    case 'huggingface': return { endpoint: 'https://router.huggingface.co/v1/chat/completions' };
    default: throw new Error(`مزوّد غير معروف: ${provider}`);
  }
}

async function callProvider(provider: string, apiKey: string, model: string, messages: ChatMessage[]) {
  const { endpoint, extraHeaders } = providerEndpoint(provider);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(extraHeaders ?? {}) },
    body: JSON.stringify({ model, messages, tools: AGENT_TOOLS, tool_choice: 'auto', max_tokens: 800, temperature: 0.4 }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data)
      ? (typeof (data as Json).error === 'string' ? (data as Json).error as string : ((data as Json).error as Json)?.message as string)
      : `فشل الاتصال بمزوّد الذكاء الاصطناعي (HTTP ${res.status})`;
    throw new Error(msg || 'فشل الاتصال بمزوّد الذكاء الاصطناعي.');
  }
  const choice = data?.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    toolCalls: (choice?.message?.tool_calls ?? []) as Array<{ id: string; function: { name: string; arguments: string } }>,
  };
}

function buildSystemPrompt(companyName: string, hasApiKey: boolean): string {
  return `أنت "AI Command Center" — مدير عمليات ذكي يساعد صاحب متجر (${companyName || 'المتجر'}) على إدارة عمله.
أنت تتحدث مع التاجر نفسه (Merchant/Owner)، وليس مع زبون.

قواعد إلزامية:
- لا تخترع بيانات إطلاقاً. أي رقم أو معلومة عن الطلبات/المنتجات/القنوات يجب أن تأتي من استدعاء الأداة المناسبة أولاً.
- إذا طلب التاجر بيانات (طلبات، منتجات، قنوات، عملاء، إحصائيات)، استدعِ الأداة المناسبة فوراً بدل الافتراض.
- قبل تنفيذ أي إجراء حساس (إرسال رسالة، تحديث طلب أو منتج، إنشاء جدولة) اعرض على التاجر ماذا ستفعل بالضبط واطلب تأكيداً صريحاً ("نعم"، "أكّد"، "ابعتها") قبل استدعاء الأداة الفعلية — إلا إذا كان طلب التاجر نفسه تأكيداً واضحاً على رسالة سابقة.
- بعد تنفيذ أي أداة، لخّص النتيجة الحقيقية للتاجر بوضوح ولغة عربية طبيعية ومختصرة.
- إذا فشلت أداة، أخبر التاجر بالخطأ الحقيقي بصراحة ولا تدّعِ نجاحاً وهمياً.
${hasApiKey ? '' : '\nملاحظة: لا يوجد مفتاح API مفعّل بعد لهذا المتجر — إن ظهرت لك هذه الرسالة فهذا خطأ بالتهيئة يجب إبلاغ التاجر به.'}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('الطريقة غير مدعومة.', 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return fail('إعدادات Supabase الخلفية ناقصة.', 500);

  const originalAuthHeader = req.headers.get('Authorization') ?? '';
  const token = authToken(req);
  if (!token) return fail('جلسة الدخول غير موجودة.', 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const identity = await merchantForUser(admin, SUPABASE_URL, token);
  if (!identity) return fail('لا يمكن التحقق من صلاحية التاجر.', 403);

  let body: Json;
  try { body = await req.json(); } catch { return fail('جسم الطلب غير صالح.'); }
  const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (!userMessage) return fail('الرسالة مطلوبة.');
  let conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null;

  const merchantId = identity.merchant.id;

  // 1) تحميل/إنشاء المحادثة
  if (conversationId) {
    const { data: existing } = await admin.from('ai_agent_conversations').select('id').eq('id', conversationId).eq('merchant_id', merchantId).maybeSingle();
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error: createErr } = await admin
      .from('ai_agent_conversations')
      .insert({ merchant_id: merchantId, user_id: identity.user.id, title: userMessage.slice(0, 60) })
      .select('id').single();
    if (createErr) return fail('تعذّر إنشاء محادثة جديدة.', 500);
    conversationId = created.id as string;
  }

  // 2) تحميل إعدادات AI الحقيقية (نفس التي يضبطها التاجر في AI Studio)
  const { data: aiConfig } = await admin.from('ai_configs').select('ai_provider, ai_model, api_key').eq('merchant_id', merchantId).maybeSingle();
  const provider = aiConfig?.ai_provider || 'openai';
  const model = aiConfig?.ai_model || 'gpt-4o-mini';
  const apiKey = aiConfig?.api_key || '';

  await admin.from('ai_agent_messages').insert({ conversation_id: conversationId, merchant_id: merchantId, role: 'user', content: userMessage });

  if (!apiKey) {
    const notice = 'لم يتم ضبط مفتاح API للذكاء الاصطناعي بعد. افتح صفحة AI Studio > مفتاح API وأضف مفتاحك أولاً حتى أستطيع فهم أوامرك وتنفيذها.';
    await admin.from('ai_agent_messages').insert({ conversation_id: conversationId, merchant_id: merchantId, role: 'assistant', content: notice });
    await admin.from('ai_agent_conversations').update({ last_message: notice, last_message_at: new Date().toISOString() }).eq('id', conversationId);
    return json({ ok: true, conversation_id: conversationId, message: notice, actions: [] });
  }

  // 3) بناء سياق المحادثة من آخر رسائل حقيقية محفوظة
  const { data: history } = await admin
    .from('ai_agent_messages')
    .select('role, content, tool_calls, tool_name, tool_result')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_MESSAGES);

  const messages: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(identity.merchant.company_name ?? '', Boolean(apiKey)) }];
  for (const m of history ?? []) {
    if (m.role === 'user') messages.push({ role: 'user', content: m.content ?? '' });
    else if (m.role === 'assistant') messages.push({ role: 'assistant', content: m.content ?? '' });
    // رسائل tool القديمة لا تُعاد حرفياً بالسياق (تبسيطاً)؛ ملخصها موجود ضمن رد assistant التالي لها.
  }

  const actionsExecuted: Json[] = [];

  try {
    let iterations = 0;
    let finalText: string | null = null;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;
      const { content, toolCalls } = await callProvider(provider, apiKey, model, messages);

      if (!toolCalls.length) {
        finalText = content ?? 'لم أتمكن من توليد رد.';
        break;
      }

      messages.push({ role: 'assistant', content: content ?? '', tool_calls: toolCalls });

      for (const call of toolCalls) {
        const toolName = call.function?.name ?? '';
        let args: Json = {};
        try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* keep {} */ }

        let toolResult: unknown;
        let status: 'completed' | 'failed' = 'completed';
        let errorMessage: string | null = null;
        try {
          toolResult = await executeAgentTool(
            { admin, supabaseUrl: SUPABASE_URL, identity, originalAuthHeader },
            toolName,
            args,
          );
        } catch (err) {
          status = 'failed';
          errorMessage = err instanceof Error ? err.message : 'فشل تنفيذ الأداة.';
          toolResult = { error: errorMessage };
        }

        await logAgentAction(admin, {
          merchantId, actorId: identity.user.id, conversationId,
          actionType: toolName, payload: args, result: toolResult, status, errorMessage,
        });
        await admin.from('ai_agent_messages').insert({
          conversation_id: conversationId, merchant_id: merchantId, role: 'tool',
          tool_name: toolName, tool_result: toolResult as Json, content: JSON.stringify(toolResult),
        });
        actionsExecuted.push({ tool: toolName, args, status, error: errorMessage, read_only: isReadOnlyTool(toolName) });

        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) });
      }
    }

    if (!finalText) finalText = 'قمت بتنفيذ الطلب، لكن احتجت وقتاً أطول من المتاح — اسألني عن التفاصيل إذا لزم.';

    await admin.from('ai_agent_messages').insert({ conversation_id: conversationId, merchant_id: merchantId, role: 'assistant', content: finalText });
    await admin.from('ai_agent_conversations').update({ last_message: finalText, last_message_at: new Date().toISOString() }).eq('id', conversationId);

    return json({ ok: true, conversation_id: conversationId, message: finalText, actions: actionsExecuted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء معالجة الطلب.';
    await admin.from('ai_agent_messages').insert({ conversation_id: conversationId, merchant_id: merchantId, role: 'assistant', content: `❌ ${message}` });
    return fail(message, 502);
  }
});
