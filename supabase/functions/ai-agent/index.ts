// supabase/functions/ai-agent/index.ts
//
// واجهة استدعاء مباشرة ومهيكلة (بدون نموذج LLM) لتنفيذ أدوات الوكيل —
// مفيدة لأزرار الواجهة التي تنفذ إجراءً محدداً مباشرة (مثل "تأكيد
// الإرسال" أو "تحديث حالة الطلب" من شاشة الطلبات) بدل المرور عبر محادثة.
// المنطق الفعلي لكل أداة موحّد مع ai-agent-chat عبر _shared/agentCore.ts
// حتى لا يوجد نسخ لمنطقين مختلفين لنفس العملية.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authToken, executeAgentTool, logAgentAction, merchantForUser, type Json } from '../_shared/agentCore.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// أسماء الإجراءات القديمة (متوافقة مع أي مستدعٍ سابق) → اسم الأداة الموحّد بـ agentCore.
const ACTION_TO_TOOL: Record<string, string> = {
  list_data: '__list_data__', // معالجة خاصة أدناه (جدول عام)
  update_product: 'update_product',
  update_order: 'update_order',
  create_workflow: 'create_workflow',
  create_schedule: 'create_schedule',
  send_message: 'send_message',
};

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400) { return json({ ok: false, error: message }, status); }

function allowedTable(table: unknown): table is 'channels' | 'products' | 'orders' | 'conversations' | 'workflows' | 'customers' {
  return ['channels', 'products', 'orders', 'conversations', 'workflows', 'customers'].includes(String(table));
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
  const action = String(body.action ?? '');
  if (!(action in ACTION_TO_TOOL)) return fail('الإجراء غير معروف.');

  const merchantId = identity.merchant.id;

  try {
    let result: unknown;
    if (action === 'list_data') {
      if (!allowedTable(body.table)) throw new Error('الجدول المطلوب غير مسموح للوكيل.');
      const columns = body.table === 'products' ? 'id,name,description,price,stock,status,sku,image_url' : '*';
      const { data, error } = await admin.from(body.table).select(columns).eq('merchant_id', merchantId).limit(100);
      if (error) throw error;
      result = { rows: data ?? [] };
    } else if (action === 'update_order') {
      result = await executeAgentTool({ admin, supabaseUrl: SUPABASE_URL, identity, originalAuthHeader }, 'update_order', { order_id: body.id, status: (body.patch as Json)?.status });
    } else if (action === 'update_product') {
      const patch = (body.patch as Json) ?? {};
      result = await executeAgentTool({ admin, supabaseUrl: SUPABASE_URL, identity, originalAuthHeader }, 'update_product', { product_id: body.id, ...patch });
    } else {
      result = await executeAgentTool({ admin, supabaseUrl: SUPABASE_URL, identity, originalAuthHeader }, ACTION_TO_TOOL[action], body);
    }

    await logAgentAction(admin, { merchantId, actorId: identity.user.id, actionType: action, targetId: typeof body.id === 'string' ? body.id : action, payload: body, result, status: 'completed' });
    return json({ ok: true, action, ...(result as Json) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'فشل تنفيذ الإجراء.';
    await logAgentAction(admin, { merchantId, actorId: identity.user.id, actionType: action, targetId: typeof body.id === 'string' ? body.id : action, payload: body, status: 'failed', errorMessage: message });
    return fail(message, 422);
  }
});
