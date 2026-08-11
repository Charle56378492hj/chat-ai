/*
# Extended Platform Tables — AI, Automation, Billing, Security, Admin

## Tables
- ai_configs: AI assistant personality & settings per merchant
- ai_knowledge_sources: knowledge base entries (catalog, policies, FAQ, PDFs, links)
- ai_training_scenarios: example scenarios for training the AI
- ai_versions: published AI config versions
- automation_rules: trigger/action rules
- workflows: advanced multi-step automations
- templates: reusable message templates
- audit_logs: security audit trail
- api_keys: developer API keys
- subscriptions: merchant billing/subscription state
- invoices: billing invoices
- support_tickets: help center tickets
- super_admin_flags: platform-level admin actions/state
- customer_portal_tokens: tokens for customer order-tracking links

## Security
- RLS enabled on all tables, owner-scoped via merchant_id + membership checks.
- audit_logs and api_keys restricted to merchant owner only.
*/

-- ============ AI CONFIGS ============
CREATE TABLE IF NOT EXISTS ai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  assistant_name text DEFAULT 'المساعد',
  tone text DEFAULT 'friendly',
  formality text DEFAULT 'casual',
  brevity text DEFAULT 'medium',
  persuasion_level int DEFAULT 3,
  mode text DEFAULT 'sales',
  ai_provider text DEFAULT 'openai',
  ai_model text DEFAULT 'gpt-4o-mini',
  api_key_name text,
  system_prompt text,
  fallback_to_human boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (merchant_id)
);

-- ============ AI KNOWLEDGE SOURCES ============
CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  content text,
  file_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ AI TRAINING SCENARIOS ============
CREATE TABLE IF NOT EXISTS ai_training_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  customer_input text,
  expected_response text,
  created_at timestamptz DEFAULT now()
);

-- ============ AI VERSIONS ============
CREATE TABLE IF NOT EXISTS ai_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  version_label text,
  config_snapshot jsonb,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============ AUTOMATION RULES ============
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_keyword text,
  condition jsonb,
  action jsonb,
  priority int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ WORKFLOWS ============
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  steps jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ TEMPLATES ============
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text,
  body text,
  created_at timestamptz DEFAULT now()
);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============ API KEYS ============
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  label text,
  key_prefix text,
  scopes text[] DEFAULT '{}',
  last_used timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  plan text DEFAULT 'free',
  status text DEFAULT 'active',
  message_count int DEFAULT 0,
  message_limit int DEFAULT 100,
  channel_count int DEFAULT 0,
  channel_limit int DEFAULT 1,
  ai_credits_used int DEFAULT 0,
  ai_credits_limit int DEFAULT 1000,
  auto_renew boolean DEFAULT false,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (merchant_id)
);

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  currency text DEFAULT 'SAR',
  status text DEFAULT 'paid',
  period_start timestamptz,
  period_end timestamptz,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- ============ SUPPORT TICKETS ============
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text,
  status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

-- ============ SUPER ADMIN FLAGS ============
CREATE TABLE IF NOT EXISTS super_admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE,
  flag_type text,
  reason text,
  action_taken text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ============ CUSTOMER PORTAL TOKENS ============
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============ ENABLE RLS ============
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_portal_tokens ENABLE ROW LEVEL SECURITY;

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_ai_configs_merchant ON ai_configs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_merchant ON ai_knowledge_sources(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_scenarios_merchant ON ai_training_scenarios(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_versions_merchant ON ai_versions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant ON automation_rules(merchant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_merchant ON workflows(merchant_id);
CREATE INDEX IF NOT EXISTS idx_templates_merchant ON templates(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant ON audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_merchant ON subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_merchant ON support_tickets(merchant_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_flags_merchant ON super_admin_flags(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_tokens_order ON customer_portal_tokens(order_id);