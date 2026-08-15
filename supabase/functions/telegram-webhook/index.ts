// supabase/functions/telegram-webhook/index.ts
//
// هاد الـ endpoint يلي تيليغرام بيبعتلّه رسائل المستخدمين (Webhook).
// قبل هاي الدالة، صفحة "القنوات" كانت بس تتحقق من صحة التوكن (getMe) وتخزّنه
// بقاعدة البيانات — بس محدا كان يسجّل هالرابط عند تيليغرام (setWebhook)، ومحدا
// كان جاهز يستقبل الرسائل أصلاً. هلق:
//
//   تيليغرام  →  هاد الـ Edge Function (/telegram-webhook?channel_id=...)
//              →  يجيب إعدادات الذكاء الاصطناعي تبع التاجر
//              →  يرد على العميل تلقائيًا عبر Telegram sendMessage
//              →  يخزّن المحادثة والرسائل بجداول conversations/messages
//                 (حتى تظهر بصفحة "صندوق الوارد" بالتطبيق).
//
// رابط الويبهوك لكل بوت لازم يحتوي channel_id تبع صف القناة بجدول channels،
// حتى نعرف لأي تاجر تعود هاي الرسالة (تيليغرام ما بيرسل هيك معلومة بالـ payload).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// نفس منطق بناء الـ system prompt الموجود بصفحة AI Studio (src/pages/app/AiStudioPage.tsx)
// — لازم يبقوا متطابقين حتى يجي رد البوت بنفس شخصية المساعد المُعدّة بالتطبيق.
function buildSystemPrompt(config: {
  assistant_name: string;
  tone: string;
  formality: string;
  brevity: string;
  persuasion_level: number;
  mode: string;
  system_prompt: string | null;
}): string {
  const toneMap: Record<string, string> = {
    friendly: 'ودود ومرح',
    professional: 'احترافي وجاد',
    enthusiastic: 'متحمس وإيجابي',
    calm: 'هادئ ومتزن',
  };
  const brevityMap: Record<string, string> = {
    short: 'ردود قصيرة جداً في 1-2 جملة',
    medium: 'ردود متوسطة في 2-4 جمل',
    long: 'ردود مفصلة ومستوفية',
  };
  const modeMap: Record<string, string> = {
    sales: 'مساعد مبيعات يهدف لإتمام الصفقة بأسلوب لطيف غير ضاغط',
    support: 'مساعد دعم عملاء يحل المشكلات بصبر وكفاءة',
    full: 'مساعد شامل يجمع بين المبيعات والدعم',
  };

  return `أنت ${config.assistant_name}، مساعد ذكاء اصطناعي ${modeMap[config.mode] ?? 'للتجارة الإلكترونية'}.
أسلوبك ${toneMap[config.tone] ?? 'ودود'} و${config.formality === 'formal' ? 'رسمي' : 'غير رسمي'}.
اكتب ${brevityMap[config.brevity] ?? 'ردود متوسطة'}.
مستوى الإقناع: ${config.persuasion_level}/5.
قواعد مهمة:
- رد دائمًا باللغة العربية إلا إذا كتب العميل بلغة أخرى
- لا تختلق معلومات عن المنتجات إذا لم تعرفها
- كن صادقًا وأمينًا مع العميل
${config.system_prompt ? `\nتعليمات إضافية:\n${config.system_prompt}` : ''}`;
}

// نفس منطق استدعاء المزوّد الموجود بدالة ai-proxy — مكرر هون قصدًا حتى تبقى
// كل دالة مستقلة بذاتها (بدون ما تعتمد وحدة عالتانية بوقت التشغيل).
async function callProvider(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let endpoint = '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const body: Record<string, unknown> = { model, messages, max_tokens: 300, temperature: 0.7 };

  if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://supabase.co';
    headers['X-Title'] = 'Auto Reply Bot'; // لازم تبقى ASCII (راجع ملاحظة ai-proxy)
  } else if (provider === 'google') {
    endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'huggingface') {
    endpoint = 'https://router.huggingface.co/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    return null;
  }

  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // ما في داعي نرمي خطأ هون — إذا فشل الإرسال، أهم شي منرجع 200 لتيليغرام
    // حتى ما يعيد إرسال نفس التحديث بحلقة لا نهائية.
  }
}

Deno.serve(async (req: Request) => {
  // تيليغرام دايمًا بيبعت POST. أي طلب تاني منرجّعله ok بدون معالجة.
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  const url = new URL(req.url);
  const channelId = url.searchParams.get('channel_id');

  // مهم: دايمًا نرجّع 200 لتيليغرام حتى لو صار خطأ عندنا، وإلا رح يعيد
  // إرسال نفس الرسالة بشكل متكرر لمدة طويلة.
  const ok = () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!channelId) return ok();

  let update: {
    message?: {
      chat: { id: number };
      from?: { first_name?: string; username?: string };
      text?: string;
    };
  };
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  const msg = update.message;
  if (!msg?.text || !msg.chat?.id) return ok(); // نتجاهل الصور/الملصقات إلخ حاليًا

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1) القناة (bot_token + التاجر)
  const { data: channel } = await supabase
    .from('channels')
    .select('id, merchant_id, status, config')
    .eq('id', channelId)
    .eq('type', 'telegram')
    .maybeSingle();

  if (!channel || channel.status !== 'connected') return ok();

  const botToken = (channel.config as Record<string, string> | null)?.bot_token;
  if (!botToken) return ok();

  const chatId = msg.chat.id;
  const customerName = msg.from?.first_name || msg.from?.username || 'عميل تيليغرام';

  // 2) العميل — نبحث عنه بمعرّف المحادثة (chat id) ضمن نفس التاجر والقناة، وإلا ننشئه
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('merchant_id', channel.merchant_id)
    .eq('channel', 'telegram')
    .eq('external_id', String(chatId))
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        merchant_id: channel.merchant_id,
        name: customerName,
        channel: 'telegram',
        external_id: String(chatId),
        last_contact: new Date().toISOString(),
      })
      .select('id')
      .single();
    customer = newCustomer;
  }

  if (!customer) return ok();

  // 3) المحادثة — نبحث عن محادثة مفتوحة لنفس العميل بهاي القناة، وإلا ننشئها
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, ai_enabled')
    .eq('merchant_id', channel.merchant_id)
    .eq('channel_id', channel.id)
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!conversation) {
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        merchant_id: channel.merchant_id,
        customer_id: customer.id,
        channel_id: channel.id,
        status: 'open',
        ai_enabled: true,
      })
      .select('id, ai_enabled')
      .single();
    conversation = newConversation;
  }

  if (!conversation) return ok();

  // 4) نسجّل رسالة العميل
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender: 'customer',
    content: msg.text,
    is_auto: false,
  });
  await supabase
    .from('conversations')
    .update({
      last_message: msg.text,
      last_message_at: new Date().toISOString(),
      unread_count: 1,
    })
    .eq('id', conversation.id);
  await supabase.from('customers').update({ last_contact: new Date().toISOString() }).eq('id', customer.id);

  // إذا المستخدم عطّل الذكاء الاصطناعي لهاي المحادثة تحديدًا، منوقف هون
  // (الرسالة اتسجلت، بس محدا يرد تلقائيًا — موظف بشري رح يشوفها بصندوق الوارد)
  if (conversation.ai_enabled === false) return ok();

  // 5) إعدادات الذكاء الاصطناعي تبع التاجر
  const { data: aiConfig } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('merchant_id', channel.merchant_id)
    .maybeSingle();

  if (!aiConfig || aiConfig.is_active === false || !aiConfig.api_key) return ok();

  const systemPrompt = buildSystemPrompt({
    assistant_name: aiConfig.assistant_name ?? 'المساعد',
    tone: aiConfig.tone ?? 'friendly',
    formality: aiConfig.formality ?? 'casual',
    brevity: aiConfig.brevity ?? 'medium',
    persuasion_level: aiConfig.persuasion_level ?? 3,
    mode: aiConfig.mode ?? 'sales',
    system_prompt: aiConfig.system_prompt ?? null,
  });

  const reply = await callProvider(
    aiConfig.ai_provider ?? 'openai',
    aiConfig.api_key,
    aiConfig.ai_model ?? 'gpt-4o-mini',
    systemPrompt,
    msg.text
  );

  const finalReply = reply ?? 'عذرًا، حدث خطأ مؤقت. سيتواصل معك أحد ممثلي خدمة العملاء قريبًا.';

  // 6) نرسل الرد لتيليغرام ونسجّله كرسالة بالمحادثة
  await sendTelegramMessage(botToken, chatId, finalReply);
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender: 'ai',
    content: finalReply,
    is_auto: true,
  });
  await supabase
    .from('conversations')
    .update({ last_message: finalReply, last_message_at: new Date().toISOString(), unread_count: 0 })
    .eq('id', conversation.id);

  return ok();
});
