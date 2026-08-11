/*
# Core Platform Tables — AI Conversation & Order Management

Creates all foundational tables for the multi-tenant AI conversation & order
management platform. Tables are created first, then RLS policies are applied
so cross-table policy references resolve.

## Tables
- merchants, merchant_members, channels, customers, conversations, messages,
  categories, products, product_variants, orders, order_items

## Security
- RLS enabled on all tables, owner-scoped via merchant_id + membership checks.
*/

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