-- ═══════════════════════════════════════════════════════════════════════════
-- ربط واتساب عبر QR (Baileys) — جداول الجلسة والإشعارات
--
-- ليش هالجداول ضرورية؟
-- ربط واتساب بمسح QR بينتج "جلسة جهاز مرتبط" (Multi-Device). إذا ما انحفظت
-- هالجلسة بمكان دائم، كل إعادة تشغيل للسيرفر بتضيّعها ويضطر الزبون يمسح QR
-- من جديد. منخزّنها هون بقاعدة البيانات فتبقى الجلسة دائمة والربط ما بينقطع.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) حالة جلسة واتساب لكل قناة ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  channel_id uuid PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'idle',
  phone_number text,
  jid text,
  last_connected_at timestamptz,
  last_disconnect_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read whatsapp sessions" ON public.whatsapp_sessions;
CREATE POLICY "members read whatsapp sessions"
  ON public.whatsapp_sessions FOR SELECT TO authenticated
  USING (public.auth_uid_is_member_of(merchant_id));

-- ── 2) بيانات المصادقة المشفّرة تبع واتساب (creds + signal keys) ───────────
-- ⚠️ هذا الجدول حسّاس جدًا: من يقرأه يقدر ينتحل جلسة واتساب تبع التاجر.
-- لهيك ما منعطي أي صلاحية لا لـ anon ولا لـ authenticated — البوابة فقط
-- (service_role) بتوصله.
CREATE TABLE IF NOT EXISTS public.whatsapp_auth_state (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, key)
);

GRANT ALL ON public.whatsapp_auth_state TO service_role;

ALTER TABLE public.whatsapp_auth_state ENABLE ROW LEVEL SECURITY;
-- بدون أي policy: ولا مستخدم عادي بيقدر يقرأ أو يكتب هون إطلاقًا.

CREATE INDEX IF NOT EXISTS idx_wa_auth_state_channel ON public.whatsapp_auth_state(channel_id);

-- ── 3) إشعارات القنوات (فصل/إعادة اتصال/ربط ناجح) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.channel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'whatsapp',
  level text NOT NULL DEFAULT 'info',   -- info | success | warning | error
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, UPDATE ON public.channel_events TO authenticated;
GRANT ALL ON public.channel_events TO service_role;

ALTER TABLE public.channel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read channel events" ON public.channel_events;
CREATE POLICY "members read channel events"
  ON public.channel_events FOR SELECT TO authenticated
  USING (public.auth_uid_is_member_of(merchant_id));

DROP POLICY IF EXISTS "members update channel events" ON public.channel_events;
CREATE POLICY "members update channel events"
  ON public.channel_events FOR UPDATE TO authenticated
  USING (public.auth_uid_is_member_of(merchant_id))
  WITH CHECK (public.auth_uid_is_member_of(merchant_id));

CREATE INDEX IF NOT EXISTS idx_channel_events_merchant ON public.channel_events(merchant_id, created_at DESC);

-- ── 4) بث التحديثات لحظيًا للواجهة (Realtime) ─────────────────────────────
-- هيك صفحة القنوات بتعرف فورًا إنو الربط نجح أو إنو صار فصل، بدون تحديث يدوي.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
