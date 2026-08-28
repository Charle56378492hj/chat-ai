import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const gatewayUrl = (Deno.env.get('WHATSAPP_GATEWAY_URL') ?? '').replace(/\/$/, '');
const gatewaySecret = Deno.env.get('WHATSAPP_GATEWAY_SECRET') ?? '';
const cronSecret = Deno.env.get('AI_AGENT_CRON_SECRET') ?? '';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

type Schedule = { id: string; merchant_id: string; channel_id: string | null; recipient: string | null; instruction: string; timezone: string; };
function response(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: corsHeaders }); }
function report(counts: { products: number; orders: number; conversations: number }, company: string) {
  return `التقرير اليومي — ${company}\nالمنتجات: ${counts.products}\nالطلبات: ${counts.orders}\nالمحادثات: ${counts.conversations}\nتم إنشاؤه تلقائياً بواسطة AI Agent.`;
}
async function count(admin: ReturnType<typeof createClient>, table: string, merchantId: string) {
  const { count: value, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId);
  if (error) throw error;
  return value ?? 0;
}
async function runSchedule(admin: ReturnType<typeof createClient>, schedule: Schedule) {
  if (!schedule.channel_id || !schedule.recipient) throw new Error('الجدولة لا تحتوي قناة أو مستلماً.');
  const [{ data: merchant }, products, orders, conversations] = await Promise.all([
    admin.from('merchants').select('company_name').eq('id', schedule.merchant_id).maybeSingle(),
    count(admin, 'products', schedule.merchant_id), count(admin, 'orders', schedule.merchant_id), count(admin, 'conversations', schedule.merchant_id),
  ]);
  if (!gatewayUrl || !gatewaySecret) throw new Error('إعدادات بوابة WhatsApp الخلفية ناقصة.');
  const res = await fetch(`${gatewayUrl}/api/internal/sessions/${schedule.channel_id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gateway-secret': gatewaySecret }, body: JSON.stringify({ to: schedule.recipient, text: report({ products, orders, conversations }, merchant?.company_name ?? 'متجرك') }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `فشل إرسال التقرير (${res.status})`);
}
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (cronSecret && req.headers.get('x-ai-agent-cron-secret') !== cronSecret) return response({ ok: false, error: 'غير مصرح' }, 401);
  if (!supabaseUrl || !serviceKey) return response({ ok: false, error: 'إعدادات Supabase ناقصة' }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: schedules, error } = await admin.from('ai_agent_schedules').select('id,merchant_id,channel_id,recipient,instruction,timezone').eq('is_active', true).lte('next_run_at', new Date().toISOString()).limit(50);
  if (error) return response({ ok: false, error: error.message }, 500);
  const results: Array<Record<string, unknown>> = [];
  for (const schedule of (schedules ?? []) as Schedule[]) {
    try {
      await runSchedule(admin, schedule);
      await admin.from('ai_agent_schedules').update({ last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', schedule.id);
      await admin.from('ai_agent_actions').insert({ merchant_id: schedule.merchant_id, action_type: 'scheduled_report', target_table: 'ai_agent_schedules', target_id: schedule.id, payload: { recipient: schedule.recipient }, status: 'completed', completed_at: new Date().toISOString() });
      results.push({ id: schedule.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل غير معروف';
      await admin.from('ai_agent_actions').insert({ merchant_id: schedule.merchant_id, action_type: 'scheduled_report', target_table: 'ai_agent_schedules', target_id: schedule.id, payload: { recipient: schedule.recipient }, status: 'failed', error_message: message });
      results.push({ id: schedule.id, ok: false, error: message });
    }
  }
  return response({ ok: true, processed: results.length, results });
});
