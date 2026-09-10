// supabase/functions/_shared/agentCore.ts
//
// المنطق المشترك بين ai-agent و ai-agent-chat: التحقق من هوية التاجر،
// تعريف أدوات (tools) الوكيل، وتنفيذها بشكل آمن ومحصور بصلاحيات
// merchant_id الخاص بصاحب الجلسة فقط — لا وصول مباشر وغير محدود لقاعدة
// البيانات، ولا تجاوز لصلاحيات التاجر.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type Json = Record<string, unknown>;

export interface MerchantIdentity {
  user: { id: string; email?: string | null };
  merchant: { id: string; company_name: string | null };
}

export function authToken(req: Request): string {
  return req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

export async function merchantForUser(
  admin: SupabaseClient,
  supabaseUrl: string,
  token: string,
): Promise<MerchantIdentity | null> {
  if (!token) return null;
  // مرّر JWT صراحةً إلى getUser بدلاً من استخدامه كـ anon key عند إنشاء client.
  // createClient(url, token) يعتبر الوسيط الثاني مفتاح API، وليس access token؛
  // لذلك كان getUser() يعمل بدون جلسة فعلية وينتهي دائماً بفشل التحقق.
  void supabaseUrl; // يبقى ضمن التوقيع للتوافق مع المستدعين الحاليين.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: merchant } = await admin
    .from('merchants')
    .select('id, company_name')
    .eq('owner_id', userData.user.id)
    .maybeSingle();
  if (merchant) return { user: userData.user, merchant };

  // ليس مالكاً — تحقق إن كان عضو فريق (merchant_members) بدلاً من ذلك.
  const { data: membership } = await admin
    .from('merchant_members')
    .select('merchant_id, merchants!inner(id, company_name)')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (membership?.merchants) {
    const m = membership.merchants as unknown as { id: string; company_name: string | null };
    return { user: userData.user, merchant: m };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Tool schemas (OpenAI-compatible function calling — يدعمها كل من
// OpenAI / OpenRouter / Google (عبر endpoint التوافق) بنفس الصيغة).
// ─────────────────────────────────────────────────────────────────────────

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'view_orders',
      description: 'عرض طلبات المتجر الحقيقية، مع إمكانية الفلترة حسب الحالة.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: "حالة الطلب للفلترة، مثال: pending, processing, shipped, delivered, cancelled, returned. اتركها فارغة لعرض الكل." },
          limit: { type: 'number', description: 'أقصى عدد نتائج (افتراضي 20، حد أقصى 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_products',
      description: 'عرض منتجات المتجر، مع خيار عرض قليلة المخزون فقط.',
      parameters: {
        type: 'object',
        properties: {
          low_stock: { type: 'boolean', description: 'إذا true يعرض فقط المنتجات التي كميتها أقل من 5.' },
          limit: { type: 'number', description: 'أقصى عدد نتائج (افتراضي 20، حد أقصى 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_channels',
      description: 'عرض قنوات التواصل المتصلة بالمتجر (واتساب، تيليغرام، فيسبوك، إنستغرام، بريد).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_customers',
      description: 'البحث عن عملاء المتجر بالاسم أو رقم الهاتف.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'جزء من اسم العميل أو رقم هاتفه.' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analytics_summary',
      description: 'ملخص إحصائي حقيقي: عدد الطلبات حسب الحالة، إجمالي المبيعات، أكثر المنتجات مبيعاً خلال آخر 7 أيام.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_order',
      description: 'تحديث حالة طلب موجود فعلاً. يتطلب تأكيد التاجر أولاً لأنه إجراء حساس.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string' },
          status: { type: 'string', description: 'pending, processing, shipped, delivered, cancelled, returned' },
        },
        required: ['order_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product',
      description: 'تحديث سعر أو مخزون أو حالة منتج موجود فعلاً.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          price: { type: 'number' },
          stock: { type: 'number' },
          status: { type: 'string', description: 'active, draft, archived' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'إرسال رسالة نصية فورية لعميل عبر قناة متصلة فعلاً (واتساب، تيليغرام، أو بريد إلكتروني). لا تستخدمها إلا بعد أن يؤكد التاجر صراحة الرسالة والمستلم.',
      parameters: {
        type: 'object',
        properties: {
          channel_id: { type: 'string', description: 'معرّف القناة كما يظهر من view_channels.' },
          recipient: { type: 'string', description: 'رقم الهاتف (واتساب/تيليغرام) أو البريد الإلكتروني.' },
          text: { type: 'string' },
          subject: { type: 'string', description: 'عنوان الرسالة إذا كانت القناة بريد إلكتروني.' },
        },
        required: ['channel_id', 'recipient', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_schedule',
      description: 'إنشاء جدولة يومية متكررة (مثلاً تقرير يومي بوقت محدد يُرسل عبر قناة). التكرار مدعوم حالياً بشكل يومي فقط.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          instruction: { type: 'string', description: 'وصف المهمة التي ستُنفذ (تقرير المبيعات اليومي مثلاً).' },
          hour: { type: 'number', description: 'الساعة (0-23) بتوقيت المتجر.' },
          minute: { type: 'number', description: 'الدقيقة (0-59)، افتراضي 0.' },
          timezone: { type: 'string', description: "مثال: 'Asia/Damascus'. افتراضي Asia/Damascus." },
          channel_id: { type: 'string' },
          recipient: { type: 'string' },
        },
        required: ['name', 'instruction', 'hour'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_workflow',
      description: 'إنشاء workflow جديد (تسلسل خطوات آلية) في نظام الأتمتة الموجود بالمتجر.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          steps: { type: 'array', items: { type: 'object' } },
        },
        required: ['name'],
      },
    },
  },
] as const;

export type AgentToolName = typeof AGENT_TOOLS[number]['function']['name'];

const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'view_orders', 'view_products', 'view_channels', 'view_customers', 'analytics_summary',
]);

export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

// ─────────────────────────────────────────────────────────────────────────
// next-run calculation for daily schedules (cron_expression = "M H * * *")
// ─────────────────────────────────────────────────────────────────────────
export function nextDailyRun(hour: number, minute: number, timezone: string): Date {
  const safeHour = Math.min(23, Math.max(0, Math.floor(hour)));
  const safeMinute = Math.min(59, Math.max(0, Math.floor(minute)));
  const now = new Date();

  // نجيب الوقت الحالي "كما يُرى" بالمنطقة الزمنية المطلوبة، لنحسب الفرق
  // ونطبّقه على UTC بدل الاعتماد على مكتبة توقيت خارجية غير متوفرة بـ Deno edge.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const localNow = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));

  const target = new Date(localNow);
  target.setUTCHours(safeHour, safeMinute, 0, 0);
  if (target.getTime() <= localNow.getTime()) target.setUTCDate(target.getUTCDate() + 1);

  const diffMs = target.getTime() - localNow.getTime();
  return new Date(now.getTime() + diffMs);
}

// ─────────────────────────────────────────────────────────────────────────
// Logging: every tool execution (success or failure) becomes one row in
// ai_agent_actions so the "Activity Log" tab reflects exactly what the AI
// actually did — never a fabricated/optimistic status.
// ─────────────────────────────────────────────────────────────────────────
export async function logAgentAction(
  admin: SupabaseClient,
  entry: {
    merchantId: string;
    actorId: string;
    conversationId?: string | null;
    actionType: string;
    targetTable?: string | null;
    targetId?: string | null;
    payload?: unknown;
    result?: unknown;
    status: 'completed' | 'failed';
    errorMessage?: string | null;
  },
) {
  await admin.from('ai_agent_actions').insert({
    merchant_id: entry.merchantId,
    actor_id: entry.actorId,
    conversation_id: entry.conversationId ?? null,
    action_type: entry.actionType,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    payload: entry.payload ?? null,
    result: entry.result ?? null,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
    completed_at: new Date().toISOString(),
  });
  // نحافظ أيضاً على audit_logs العام المستخدم بباقي المشروع (Logs page).
  await admin.from('audit_logs').insert({
    merchant_id: entry.merchantId,
    actor_id: entry.actorId,
    action: `ai_agent.${entry.actionType}${entry.status === 'failed' ? '.failed' : ''}`,
    target: entry.targetId ?? entry.actionType,
    details: entry.status === 'failed' ? { error: entry.errorMessage, input: entry.payload } : { input: entry.payload, result: entry.result },
  });
}

interface GatewaySendResult { ok: true; message_id?: string }

async function sendViaWhatsApp(channelId: string, to: string, text: string): Promise<GatewaySendResult> {
  const gatewayUrl = (Deno.env.get('WHATSAPP_GATEWAY_URL') ?? '').replace(/\/$/, '');
  const secret = Deno.env.get('WHATSAPP_GATEWAY_SECRET') ?? '';
  if (!gatewayUrl || !secret) throw new Error('بوابة واتساب غير مضبوطة على الخادم (WHATSAPP_GATEWAY_URL/SECRET).');
  const res = await fetch(`${gatewayUrl}/api/internal/sessions/${channelId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gateway-secret': secret },
    body: JSON.stringify({ to, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `فشل إرسال واتساب (${res.status})`);
  return { ok: true, message_id: body.message_id };
}

async function sendViaTelegram(channelId: string, to: string, text: string): Promise<GatewaySendResult> {
  const gatewayUrl = (Deno.env.get('TELEGRAM_GATEWAY_URL') ?? '').replace(/\/$/, '');
  const secret = Deno.env.get('TELEGRAM_GATEWAY_SECRET') ?? '';
  if (!gatewayUrl || !secret) throw new Error('بوابة تيليغرام غير مضبوطة على الخادم (TELEGRAM_GATEWAY_URL/SECRET).');
  const res = await fetch(`${gatewayUrl}/api/internal/sessions/${channelId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gateway-secret': secret },
    body: JSON.stringify({ to, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `فشل إرسال تيليغرام (${res.status})`);
  return { ok: true, message_id: body.message_id };
}

function scopedPayload(payload: unknown, merchantId: string): Json {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { merchant_id: merchantId };
  const result = { ...(payload as Json) };
  delete result.id;
  delete result.merchant_id;
  delete result.owner_id;
  return { ...result, merchant_id: merchantId };
}

export interface ExecuteContext {
  admin: SupabaseClient;
  supabaseUrl: string;
  identity: MerchantIdentity;
  originalAuthHeader: string;
}

/**
 * تنفيذ أداة واحدة بشكل محصور بصلاحيات صاحب الجلسة (identity.merchant.id
 * فقط). أي محاولة للوصول لبيانات تاجر آخر عبر تمرير id لا ينتمي لهذا
 * المتجر تُرفض بواسطة شرط .eq('merchant_id', ...) بكل استعلام.
 */
export async function executeAgentTool(ctx: ExecuteContext, name: string, args: Json): Promise<unknown> {
  const { admin, identity } = ctx;
  const merchantId = identity.merchant.id;

  switch (name) {
    case 'view_orders': {
      const limit = Math.min(100, Number(args.limit) || 20);
      let query = admin.from('orders').select('id,status,total,created_at,customer_id').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(limit);
      if (typeof args.status === 'string' && args.status) query = query.eq('status', args.status);
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case 'view_products': {
      const limit = Math.min(100, Number(args.limit) || 20);
      let query = admin.from('products').select('id,name,price,stock,status,sku').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(limit);
      if (args.low_stock === true) query = query.lt('stock', 5);
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case 'view_channels': {
      const { data, error } = await admin.from('channels').select('id,type,name,status,is_active').eq('merchant_id', merchantId);
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case 'view_customers': {
      const limit = Math.min(100, Number(args.limit) || 20);
      let query = admin.from('customers').select('id,name,phone,email').eq('merchant_id', merchantId).limit(limit);
      if (typeof args.search === 'string' && args.search.trim()) {
        const term = args.search.trim();
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case 'analytics_summary': {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: orders, error: ordersErr }, { data: items, error: itemsErr }] = await Promise.all([
        admin.from('orders').select('status,total,created_at').eq('merchant_id', merchantId),
        admin.from('order_items').select('product_name,quantity,orders!inner(merchant_id,created_at)').eq('orders.merchant_id', merchantId).gte('orders.created_at', since),
      ]);
      if (ordersErr) throw ordersErr;
      if (itemsErr) throw itemsErr;
      const byStatus: Record<string, number> = {};
      let totalRevenue = 0;
      for (const o of orders ?? []) {
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
        if (!['cancelled', 'returned'].includes(o.status)) totalRevenue += Number(o.total) || 0;
      }
      const productTotals: Record<string, number> = {};
      for (const it of (items ?? []) as { product_name: string; quantity: number }[]) {
        productTotals[it.product_name] = (productTotals[it.product_name] ?? 0) + Number(it.quantity || 0);
      }
      const topProducts = Object.entries(productTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
      return { orders_by_status: byStatus, total_revenue: totalRevenue, top_products_last_7_days: topProducts };
    }
    case 'update_order': {
      const id = String(args.order_id ?? '');
      if (!id) throw new Error('معرّف الطلب مطلوب.');
      const patch = scopedPayload({ status: args.status }, merchantId);
      const { data, error } = await admin.from('orders').update(patch).eq('id', id).eq('merchant_id', merchantId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('الطلب غير موجود أو لا ينتمي لهذا المتجر.');
      return { row: data };
    }
    case 'update_product': {
      const id = String(args.product_id ?? '');
      if (!id) throw new Error('معرّف المنتج مطلوب.');
      const patch = scopedPayload(
        { price: args.price, stock: args.stock, status: args.status },
        merchantId,
      );
      const { data, error } = await admin.from('products').update(patch).eq('id', id).eq('merchant_id', merchantId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('المنتج غير موجود أو لا ينتمي لهذا المتجر.');
      return { row: data };
    }
    case 'send_message': {
      const channelId = String(args.channel_id ?? '');
      const recipient = String(args.recipient ?? '');
      const text = String(args.text ?? '');
      if (!channelId || !recipient || !text) throw new Error('channel_id وrecipient وtext مطلوبة.');
      const { data: channel, error: channelErr } = await admin.from('channels').select('id,type,is_active').eq('id', channelId).eq('merchant_id', merchantId).maybeSingle();
      if (channelErr) throw channelErr;
      if (!channel) throw new Error('القناة غير موجودة أو لا تنتمي لهذا المتجر.');
      if (channel.is_active === false) throw new Error('القناة المحددة غير نشطة حالياً.');
      if (channel.type === 'whatsapp') return await sendViaWhatsApp(channelId, recipient, text);
      if (channel.type === 'telegram') return await sendViaTelegram(channelId, recipient, text);
      throw new Error(`الإرسال المباشر عبر ${channel.type} غير مدعوم بعد من الوكيل.`);
    }
    case 'create_schedule': {
      const name = String(args.name ?? '').trim();
      const instruction = String(args.instruction ?? '').trim();
      const hour = Number(args.hour);
      const minute = Number(args.minute ?? 0);
      const timezone = typeof args.timezone === 'string' && args.timezone.trim() ? args.timezone.trim() : 'Asia/Damascus';
      if (!name || !instruction || Number.isNaN(hour)) throw new Error('name وinstruction وhour مطلوبة.');
      const cronExpression = `${Math.max(0, Math.min(59, Math.floor(minute)))} ${Math.max(0, Math.min(23, Math.floor(hour)))} * * *`;
      const nextRun = nextDailyRun(hour, minute, timezone);
      const { data, error } = await admin.from('ai_agent_schedules').insert({
        merchant_id: merchantId,
        created_by: identity.user.id,
        channel_id: typeof args.channel_id === 'string' ? args.channel_id : null,
        recipient: typeof args.recipient === 'string' ? args.recipient : null,
        name, instruction, cron_expression: cronExpression, timezone,
        is_active: true, next_run_at: nextRun.toISOString(),
      }).select('*').single();
      if (error) throw error;
      return { row: data };
    }
    case 'create_workflow': {
      const name = String(args.name ?? '').trim();
      if (!name) throw new Error('اسم الـ workflow مطلوب.');
      const { data, error } = await admin.from('workflows').insert({
        merchant_id: merchantId,
        name,
        description: typeof args.description === 'string' ? args.description : null,
        steps: Array.isArray(args.steps) ? args.steps : [],
        is_active: true,
      }).select('*').single();
      if (error) throw error;
      return { row: data };
    }
    default:
      throw new Error(`أداة غير معروفة: ${name}`);
  }
}
