import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error('Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  throw new Error(
    'VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY مو موجودين وقت الـ build. تأكد إنهم معرّفين كـ ARG بالـ Dockerfile ومضافين كمتغيرات على Railway.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// نصدّر رابط المشروع أيضًا حتى نقدر نبني رابط الـ Edge Functions (متل telegram-webhook)
// من مكان واحد بدل ما نكرره بكل صفحة.
export const supabaseProjectUrl = supabaseUrl;
