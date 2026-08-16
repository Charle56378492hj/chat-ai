import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// عميل بصلاحية service_role — البوابة سيرفر خاص (مو متصفح)، فبيقدر يكتب
// جلسات واتساب والرسائل بدون ما يتقيّد بسياسات RLS.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
