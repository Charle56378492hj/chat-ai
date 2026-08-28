import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Json = Record<string, unknown>;
type AgentAction =
  | 'list_data'
  | 'update_product'
  | 'update_order'
  | 'update_conversation'
  | 'update_channel'
  | 'create_workflow'
  | 'create_schedule';

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fail(message: string, status = 400) { return json({ ok: false, error: message }, status); }
function authToken(req: Request) { return req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''; }
async function merchantForUser(admin: SupabaseClient, token: string) {
  const userClient = createClient(SUPABASE_URL, token, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return null;
  const { data: merchant } = await admin.from('merchants').select('id, company_name').eq('owner_id', userData.user.id).maybeSingle();
  return merchant ? { user: userData.user, merchant } : null;
}
function allowedTable(table: unknown): table is 'channels' | 'products' | 'orders' | 'conversations' | 'workflows' {
  return ['channels', 'products', 'orders', 'conversations', 'workflows'].includes(String(table));
}
function scopedPayload(payload: unknown, merchantId: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { merchant_id: merchantId };
  const result = { ...(payload as Json) };
  delete result.id;
  delete result.merchant_id;
  delete result.owner_id;
  return { ...result, merchant_id: merchantId };
}
async function execute(admin: SupabaseClient, merchantId: string, action: AgentAction, input: Json) {
  if (action === 'list_data') {
    if (!allowedTable(input.table)) throw new Error('الجدول المطلوب غير مسموح للوكيل.');
    const columns = input.table === 'products' ? 'id,name,description,price,stock,status,sku,image_url' : '*';
    const { data, error } = await admin.from(input.table).select(columns).eq('merchant_id', merchantId).limit(100);
    if (error) throw error;
    return { rows: data ?? [] };
  }
  const targetMap: Record<Exclude<AgentAction, 'list_data' | 'create_workflow' | 'create_schedule'>, string> = {
    update_product: 'products', update_order: 'orders', update_conversation: 'conversations', update_channel: 'channels',
  };
  if (action in targetMap) {
    const table = targetMap[action as keyof typeof targetMap];
    const id = typeof input.id === 'string' ? input.id : '';
    const patch = scopedPayload(input.patch, merchantId);
    if (!id) throw new Error('معرّف العنصر مطلوب.');
    const { data, error } = await admin.from(table).update(patch).eq('id', id).eq('merchant_id', merchantId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('العنصر غير موجود أو لا ينتمي إلى هذا المتجر.');
    return { row: data };
  }
  if (action === 'create_workflow') {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new Error('اسم الـ workflow مطلوب.');
    const { data, error } = await admin.from('workflows').insert({ merchant_id: merchantId, name, description: input.description ?? null, steps: Array.isArray(input.steps) ? input.steps : [], is_active: input.is_active !== false }).select('*').single();
    if (error) throw error;
    return { row: data };
  }
  if (action === 'create_schedule') {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const instruction = typeof input.instruction === 'string' ? input.instruction.trim() : '';
    const cron = typeof input.cron_expression === 'string' ? input.cron_expression.trim() : '';
    if (!name || !instruction || !cron) throw new Error('اسم الجدولة والتعليمات وcron_expression مطلوبة.');
    const { data, error } = await admin.from('ai_agent_schedules').insert({ merchant_id: merchantId, channel_id: input.channel_id ?? null, name, instruction, cron_expression: cron, timezone: input.timezone ?? 'Asia/Beirut', recipient: input.recipient ?? null, is_active: true }).select('*').single();
    if (error) throw error;
    return { row: data };
  }
  throw new Error('الإجراء غير مدعوم.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('الطريقة غير مدعومة.', 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return fail('إعدادات Supabase الخلفية ناقصة.', 500);
  const token = authToken(req);
  if (!token) return fail('جلسة الدخول غير موجودة.', 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const identity = await merchantForUser(admin, token);
  if (!identity) return fail('لا يمكن التحقق من صلاحية التاجر.', 403);
  let body: Json;
  try { body = await req.json(); } catch { return fail('جسم الطلب غير صالح.'); }
  const action = body.action as AgentAction;
  const supported: AgentAction[] = ['list_data', 'update_product', 'update_order', 'update_conversation', 'update_channel', 'create_workflow', 'create_schedule'];
  if (!supported.includes(action)) return fail('الإجراء غير معروف.');
  try {
    const result = await execute(admin, identity.merchant.id, action, body);
    await admin.from('audit_logs').insert({ merchant_id: identity.merchant.id, actor_id: identity.user.id, action: `ai_agent.${action}`, target: typeof body.id === 'string' ? body.id : action, details: { input: body, result } });
    return json({ ok: true, action, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'فشل تنفيذ الإجراء.';
    await admin.from('audit_logs').insert({ merchant_id: identity.merchant.id, actor_id: identity.user.id, action: `ai_agent.${action}.failed`, target: typeof body.id === 'string' ? body.id : action, details: { error: message } });
    return fail(message, 422);
  }
});
