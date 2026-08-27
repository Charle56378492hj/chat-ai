import { supabase } from './supabase.js';

export async function authorizeTelegramChannel(req, channelId) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'مطلوب تسجيل الدخول' };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return { ok: false, status: 401, error: 'جلسة الدخول منتهية. سجّل الدخول مجددًا.' };

  const { data: channel } = await supabase
    .from('channels')
    .select('id, merchant_id, type, name, status, config')
    .eq('id', channelId)
    .eq('type', 'telegram')
    .maybeSingle();
  if (!channel) return { ok: false, status: 404, error: 'قناة تيليغرام غير موجودة' };

  const [{ data: membership }, { data: merchant }] = await Promise.all([
    supabase.from('merchant_members').select('user_id').eq('merchant_id', channel.merchant_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('merchants').select('owner_id').eq('id', channel.merchant_id).maybeSingle(),
  ]);
  if (!membership && merchant?.owner_id !== user.id) {
    return { ok: false, status: 403, error: 'لا تملك صلاحية على هذه القناة' };
  }
  return { ok: true, user, channel };
}