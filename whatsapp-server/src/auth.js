// تحقّق الصلاحيات: كل طلب من الواجهة لازم يحمل توكن Supabase تبع المستخدم،
// ومنتأكد إنه فعلًا عضو بالمتجر صاحب القناة — حتى ما يقدر أي حدا يتحكم
// بجلسة واتساب تاجر تاني.
import { supabase } from './supabase.js';
import { getWhatsAppChannel } from './store.js';

export async function authorizeChannel(req, channelId) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'مطلوب تسجيل الدخول' };

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { ok: false, status: 401, error: 'جلسة الدخول منتهية. سجّل الدخول مجددًا.' };

  const channel = await getWhatsAppChannel(channelId);
  if (!channel) return { ok: false, status: 404, error: 'القناة غير موجودة' };

  const { data: membership } = await supabase
    .from('merchant_members')
    .select('user_id')
    .eq('merchant_id', channel.merchant_id)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: merchant } = await supabase
    .from('merchants')
    .select('owner_id')
    .eq('id', channel.merchant_id)
    .maybeSingle();

  if (!membership && merchant?.owner_id !== user.id) {
    return { ok: false, status: 403, error: 'لا تملك صلاحية على هذه القناة' };
  }

  return { ok: true, user, channel };
}
