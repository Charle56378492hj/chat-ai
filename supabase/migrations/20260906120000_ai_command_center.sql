/*
# AI Command Center — Core Tables

يضيف الجداول التي تحتاجها ترقية صفحة AI Agent إلى "AI Command Center":

1. ai_agent_conversations / ai_agent_messages
   محادثة التاجر مع الوكيل — منفصلة تماماً عن جدول conversations الخاص
   بمحادثات العملاء عبر القنوات، حتى لا نخلط بين الاثنين.

2. ai_agent_actions (Activity Log)
   سجل تنفيذ فعلي لكل أداة (tool) استدعاها الوكيل: قراءة بيانات، تحديث،
   إرسال، جدولة... تُستخدم لعرض تبويب "Activity Log" بالواجهة.
   ملاحظة: الدوال supabase/functions/ai-agent و ai-agent-scheduler كانت
   بالأصل تشير لهذا الجدول ولجدول ai_agent_schedules رغم أنهما غير
   موجودين بقاعدة البيانات — هذه الهجرة هي الإصلاح.

3. ai_agent_schedules
   الجدولة الدورية (تقرير يومي، رسالة متكررة...) التي ينشئها الوكيل بناءً
   على أمر طبيعي من التاجر، وينفذها ai-agent-scheduler عبر cron خارجي.

نستخدم نفس دوال RLS المساعدة المعتمدة أصلاً بالمشروع
(public.auth_uid_owns_merchant / public.auth_uid_is_member_of من
20260727000002_fix_rls_recursion_v2.sql) بدل EXISTS مباشرة على
merchants/merchant_members، لتفادي أي احتمال لتكرار recursion سبق حله،
ولضمان أن صاحب المتجر (owner) يرى بياناته حتى لو لم يكن مُدرجاً كعضو
بجدول merchant_members.
*/

-- ============ FIX: missing ai_configs.api_key column ============
-- اكتشفنا أثناء الفحص أن AiStudioPage.tsx يحفظ مفتاح API بعمود اسمه
-- api_key، لكن الجدول الأصلي لا يحوي سوى api_key_name (بدون عمود يخزّن
-- المفتاح الفعلي). نتيجة ذلك: حفظ مفتاح الذكاء الاصطناعي كان يفشل بصمت
-- على مستوى قاعدة البيانات، وaiProxyGateway.ts كان يقرأ أعمدة غير
-- موجودة أصلاً (api_key, provider, model بدل api_key_name/ai_provider/
-- ai_model) — ولذلك كان AI Agent يعمل دائماً بوضع Demo فقط. هذا هو الإصلاح.
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS api_key text;

-- ============ AI AGENT CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.ai_agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_conversations_merchant
  ON public.ai_agent_conversations (merchant_id, updated_at DESC);

-- ============ AI AGENT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.ai_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_agent_conversations(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,
  tool_name text,
  tool_result jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_conversation
  ON public.ai_agent_messages (conversation_id, created_at ASC);

-- ============ AI AGENT ACTIONS (Activity Log) ============
CREATE TABLE IF NOT EXISTS public.ai_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_agent_conversations(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_table text,
  target_id text,
  payload jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_actions_merchant
  ON public.ai_agent_actions (merchant_id, created_at DESC);

-- ============ AI AGENT SCHEDULES ============
CREATE TABLE IF NOT EXISTS public.ai_agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  name text NOT NULL,
  instruction text NOT NULL,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Damascus',
  recipient text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz DEFAULT now(),
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_schedules_due
  ON public.ai_agent_schedules (is_active, next_run_at);

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_agent_conversations_updated_at ON public.ai_agent_conversations;
CREATE TRIGGER trg_ai_agent_conversations_updated_at
  BEFORE UPDATE ON public.ai_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_agent_schedules_updated_at ON public.ai_agent_schedules;
CREATE TRIGGER trg_ai_agent_schedules_updated_at
  BEFORE UPDATE ON public.ai_agent_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE ON public.ai_agent_conversations TO authenticated;
GRANT SELECT, INSERT ON public.ai_agent_messages TO authenticated;
GRANT SELECT ON public.ai_agent_actions TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.ai_agent_schedules TO authenticated;
GRANT ALL ON public.ai_agent_conversations, public.ai_agent_messages, public.ai_agent_actions, public.ai_agent_schedules TO service_role;

-- ============ RLS ============
ALTER TABLE public.ai_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_schedules ENABLE ROW LEVEL SECURITY;

-- Conversations
DROP POLICY IF EXISTS "select_own_ai_conversations" ON public.ai_agent_conversations;
CREATE POLICY "select_own_ai_conversations" ON public.ai_agent_conversations FOR SELECT
  TO authenticated USING (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );
DROP POLICY IF EXISTS "insert_own_ai_conversations" ON public.ai_agent_conversations;
CREATE POLICY "insert_own_ai_conversations" ON public.ai_agent_conversations FOR INSERT
  TO authenticated WITH CHECK (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );
DROP POLICY IF EXISTS "update_own_ai_conversations" ON public.ai_agent_conversations;
CREATE POLICY "update_own_ai_conversations" ON public.ai_agent_conversations FOR UPDATE
  TO authenticated USING (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  ) WITH CHECK (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );
DROP POLICY IF EXISTS "delete_own_ai_conversations" ON public.ai_agent_conversations;
CREATE POLICY "delete_own_ai_conversations" ON public.ai_agent_conversations FOR DELETE
  TO authenticated USING (public.auth_uid_owns_merchant(merchant_id));

-- Messages (scoped by the merchant_id copied onto each row)
DROP POLICY IF EXISTS "select_own_ai_messages" ON public.ai_agent_messages;
CREATE POLICY "select_own_ai_messages" ON public.ai_agent_messages FOR SELECT
  TO authenticated USING (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );
DROP POLICY IF EXISTS "insert_own_ai_messages" ON public.ai_agent_messages;
CREATE POLICY "insert_own_ai_messages" ON public.ai_agent_messages FOR INSERT
  TO authenticated WITH CHECK (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );

-- Activity log: read-only for the merchant team; all inserts happen
-- from edge functions using the service role (bypasses RLS by design)
-- so the AI itself can never fabricate a "success" entry from the client.
DROP POLICY IF EXISTS "select_own_ai_actions" ON public.ai_agent_actions;
CREATE POLICY "select_own_ai_actions" ON public.ai_agent_actions FOR SELECT
  TO authenticated USING (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );

-- Schedules: the merchant team can view and pause/delete their own
-- schedules directly; creation still goes through the ai-agent edge
-- function (service role) so a schedule can never be created against
-- another merchant_id even if the client is compromised.
DROP POLICY IF EXISTS "select_own_ai_schedules" ON public.ai_agent_schedules;
CREATE POLICY "select_own_ai_schedules" ON public.ai_agent_schedules FOR SELECT
  TO authenticated USING (
    public.auth_uid_owns_merchant(merchant_id) OR public.auth_uid_is_member_of(merchant_id)
  );
DROP POLICY IF EXISTS "update_own_ai_schedules" ON public.ai_agent_schedules;
CREATE POLICY "update_own_ai_schedules" ON public.ai_agent_schedules FOR UPDATE
  TO authenticated USING (public.auth_uid_owns_merchant(merchant_id))
  WITH CHECK (public.auth_uid_owns_merchant(merchant_id));
DROP POLICY IF EXISTS "delete_own_ai_schedules" ON public.ai_agent_schedules;
CREATE POLICY "delete_own_ai_schedules" ON public.ai_agent_schedules FOR DELETE
  TO authenticated USING (public.auth_uid_owns_merchant(merchant_id));

-- ============ Realtime (so the chat/log UI updates live) ============
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_actions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
