-- ============================================================
-- ردّآلي - مخطط قاعدة البيانات الكامل
-- قم بتشغيل هذا الملف على Supabase SQL Editor
-- ============================================================

-- ============ MERCHANTS ============
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  country text DEFAULT 'SA',
  currency text DEFAULT 'SAR',
  language text DEFAULT 'ar',
  timezone text DEFAULT 'Asia/Riyadh',
  business_type text DEFAULT 'retail',
  phone text,
  logo_url text,
  brand_color text DEFAULT '#0EA5E9',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============ MERCHANT MEMBERS ============
CREATE TABLE IF NOT EXISTS merchant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'support',
  invited_email text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- ============ CHANNELS ============
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'disconnected',
  config jsonb DEFAULT '{}',
  last_sync timestamptz,
  webhook_url text,
  created_at timestamptz DEFAULT now()
);

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text,
  phone text,
  email text,
  city text,
  address text,
  channel text,
  tags text[] DEFAULT '{}',
  vip boolean DEFAULT false,
  notes text,
  total_orders int DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_contact timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  status text DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_enabled boolean DEFAULT true,
  priority text DEFAULT 'normal',
  last_message text,
  last_message_at timestamptz,
  unread_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'customer',
  content text,
  content_type text DEFAULT 'text',
  is_auto boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  price numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  margin numeric DEFAULT 0,
  stock int DEFAULT 0,
  image_url text,
  status text DEFAULT 'active',
  shipping_days int DEFAULT 3,
  return_policy text,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============ PRODUCT VARIANTS ============
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color text,
  size text,
  stock int DEFAULT 0,
  sku text,
  price_override numeric
);

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  order_number text,
  status text DEFAULT 'new',
  total numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  shipping numeric DEFAULT 0,
  payment_method text,
  tracking_number text,
  courier text,
  address text,
  city text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============ ORDER ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name text,
  color text,
  size text,
  quantity int DEFAULT 1,
  unit_price numeric DEFAULT 0,
  subtotal numeric DEFAULT 0
);

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
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
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
CREATE INDEX IF NOT EXISTS idx_channels_merchant ON channels(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customers_merchant ON customers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_merchant ON conversations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_merchant_members_merchant ON merchant_members(merchant_id);
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

-- ============ RLS POLICIES ============
-- (See migration files for full policy definitions)
-- Policies ensure each merchant can only access their own data.
-- Owner + team members get access; audit_logs/api_keys/invoices are owner-only.
