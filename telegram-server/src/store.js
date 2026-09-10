import { supabase } from './supabase.js';

export async function getSession(channelId) {
  const { data, error } = await supabase.from('telegram_sessions').select('*').eq('channel_id', channelId).maybeSingle();
  if (error) throw new Error(`فشل قراءة جلسة تيليغرام: ${error.message}`);
  return data;
}

export async function saveSession(channelId, merchantId, patch) {
  const { error } = await supabase.from('telegram_sessions').upsert({
    channel_id: channelId,
    merchant_id: merchantId,
    ...patch,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'channel_id' });
  if (error) throw new Error(`فشل حفظ جلسة تيليغرام: ${error.message}`);
}

export async function updateChannel(channelId, patch) {
  const { error } = await supabase.from('channels').update(patch).eq('id', channelId).eq('type', 'telegram');
  if (error) throw new Error(`فشل تحديث قناة تيليغرام: ${error.message}`);
}