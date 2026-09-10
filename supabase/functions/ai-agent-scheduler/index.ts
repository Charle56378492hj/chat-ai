import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const whatsappUrl = (Deno.env.get('WHATSAPP_GATEWAY_URL') ?? '').replace(/\/$/, '');
const whatsappSecret = Deno.env.get('WHATSAPP_GATEWAY_SECRET') ?? '';
const telegramUrl = (Deno.env.get('TELEGRAM_GATEWAY_URL') ?? '').replace(/\/$/, '');
const telegramSecret = Deno.env.get('TELEGRAM_GATEWAY_SECRET') ?? '';
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
async function dispatch(channelType: string, channelId: string, to: string, text: string) {
  if (channelType === 'whatsapp') {
    if (!whatsappUrl || !whatsappSecret) throw new Error('إعدادات بوابة WhatsApp الخلفية ناقصة.');
    const res = await fetch(`${whatsappUrl}/api/internal/sessions/${channelId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gateway-secret': whatsappSecret }, body: JSON.stringify({ to, text }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `فشل إرسال التقرير عبر واتساب (${res.status})`);
    return;
  }
  if (channelType === 'telegram') {
    if (!telegramUrl || !telegramSecret) throw new Error('إعدادات بوابة تيليغرام الخلفية ناقصة.');
    const res = await fetch(`${telegramUrl}/api/internal/sessions/${channelId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gateway-secret': telegramSecret }, body: JSON.stringify({ to, text }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `فشل إرسال التقرير عبر تيليغرام (${res.status})`);
    return;
  }
  throw new Error(`إرسال التقارير المجدولة عبر ${channelType} غير مدعوم بعد.`);
}
async function runSchedule(admin: ReturnType<typeof createClient>, schedule: Schedule) {
  if (!schedule.channel_id || !schedule.recipient) throw new Error('الجدولة لا تحتوي قناة أو مستلماً.');
  const [{ data: merchant }, { data: channel }, products, orders, conversations] = await Promise.all([
    admin.from('merchants').select('company_name').eq('id', schedule.merchant_id).maybeSingle(),
    admin.from('channels').select('type').eq('id', schedule.channel_id).eq('merchant_id', schedule.merchant_id).maybeSingle(),
    count(admin, 'products', schedule.merchant_id), count(admin, 'orders', schedule.merchant_id), count(admin, 'conversations', schedule.merchant_id),
  ]);
  if (!channel) throw new Error('القناة المرتبطة بالجدولة لم تعد موجودة.');
  const text = report({ products, orders, conversations }, merchant?.company_name ?? 'متجرك');
  await dispatch(channel.type as string, schedule.channel_id, schedule.recipient, text);
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
      await admin.from('ai_agent_schedules').update({ last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', schedule.id);
      await admin.from('ai_agent_actions').insert({ merchant_id: schedule.merchant_id, action_type: 'scheduled_report', target_table: 'ai_agent_schedules', target_id: schedule.id, payload: { recipient: schedule.recipient }, status: 'completed', completed_at: new Date().toISOString() });
      results.push({ id: schedule.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل غير معروف';
      await admin.from('ai_agent_schedules').update({ last_error: message, updated_at: new Date().toISOString() }).eq('id', schedule.id);
      await admin.from('ai_agent_actions').insert({ merchant_id: schedule.merchant_id, action_type: 'scheduled_report', target_table: 'ai_agent_schedules', target_id: schedule.id, payload: { recipient: schedule.recipient }, status: 'failed', error_message: message });
      results.push({ id: schedule.id, ok: false, error: message });
    }
  }
  return response({ ok: true, processed: results.length, results });
});
