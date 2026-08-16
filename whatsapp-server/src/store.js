// حفظ حالة الجلسة + إرسال إشعارات للتاجر (جدول channel_events) حتى يعرف
// فورًا إذا انفصل واتساب أو صار أي شي، بدل ما يكتشف بالصدفة إنه واقف.
import { supabase } from './supabase.js';
import { logError, log } from './logger.js';

export async function getWhatsAppChannel(channelId) {
  const { data, error } = await supabase
    .from('channels')
    .select('id, merchant_id, name, type, status, config')
    .eq('id', channelId)
    .eq('type', 'whatsapp')
    .maybeSingle();
  if (error) {
    logError('store', 'فشل جلب القناة', error);
    return null;
  }
  return data ?? null;
}

// كل القنوات يلي لازم ترجع تشتغل تلقائيًا بعد إعادة تشغيل السيرفر.
export async function listResumableChannels() {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('channel_id, merchant_id, status, channels!inner(id, type, status)')
    .in('status', ['connected', 'connecting', 'disconnected'])
    .eq('channels.type', 'whatsapp');
  if (error) {
    logError('store', 'فشل جلب الجلسات المحفوظة', error);
    return [];
  }
  return (data ?? []).map((row) => ({ channelId: row.channel_id, merchantId: row.merchant_id }));
}

export async function saveSessionState(channelId, merchantId, patch) {
  const row = {
    channel_id: channelId,
    merchant_id: merchantId,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { error } = await supabase.from('whatsapp_sessions').upsert(row, { onConflict: 'channel_id' });
  if (error) logError('store', 'فشل حفظ حالة الجلسة', error);
}

// نحدّث حالة القناة نفسها حتى تظهر صح بصفحة "القنوات المتصلة".
export async function setChannelStatus(channelId, status, extraConfig) {
  const patch = { status, last_sync: new Date().toISOString() };
  if (extraConfig) {
    const { data } = await supabase.from('channels').select('config').eq('id', channelId).maybeSingle();
    patch.config = { ...(data?.config ?? {}), ...extraConfig };
  }
  const { error } = await supabase.from('channels').update(patch).eq('id', channelId);
  if (error) logError('store', 'فشل تحديث حالة القناة', error);
}

export async function notify(merchantId, channelId, { level = 'info', title, message, type = 'whatsapp' }) {
  if (!merchantId) return;
  const { error } = await supabase.from('channel_events').insert({
    merchant_id: merchantId,
    channel_id: channelId,
    type,
    level,
    title,
    message,
  });
  if (error) logError('store', 'فشل تسجيل الإشعار', error);
  else log('notify', `${level} — ${title}`);
}
