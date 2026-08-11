export type Role = 'owner' | 'admin' | 'support' | 'sales' | 'warehouse' | 'viewer' | 'finance';

export interface Merchant {
  id: string;
  owner_id: string;
  company_name: string;
  country: string;
  currency: string;
  language: string;
  timezone: string;
  business_type: string;
  phone: string | null;
  logo_url: string | null;
  brand_color: string;
  is_active: boolean;
  created_at: string;
}

export interface MerchantMember {
  id: string;
  merchant_id: string;
  user_id: string | null;
  role: Role;
  invited_email: string | null;
  status: string;
  created_at: string;
}

export interface Channel {
  id: string;
  merchant_id: string;
  type: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  last_sync: string | null;
  webhook_url: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  merchant_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  channel: string | null;
  tags: string[];
  vip: boolean;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_contact: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  merchant_id: string;
  customer_id: string | null;
  channel_id: string | null;
  status: string;
  assigned_to: string | null;
  ai_enabled: boolean;
  priority: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: string;
  content: string | null;
  content_type: string;
  is_auto: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  cost: number;
  margin: number;
  stock: number;
  image_url: string | null;
  status: string;
  shipping_days: number;
  return_policy: string | null;
  keywords: string[];
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  stock: number;
  sku: string | null;
  price_override: number | null;
}

export interface Category {
  id: string;
  merchant_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  merchant_id: string;
  customer_id: string | null;
  conversation_id: string | null;
  order_number: string | null;
  status: string;
  total: number;
  discount: number;
  tax: number;
  shipping: number;
  payment_method: string | null;
  tracking_number: string | null;
  courier: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface AiConfig {
  id: string;
  merchant_id: string;
  assistant_name: string;
  tone: string;
  formality: string;
  brevity: string;
  persuasion_level: number;
  mode: string;
  ai_provider: string;
  ai_model: string;
  api_key_name: string | null;
  system_prompt: string | null;
  fallback_to_human: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  merchant_id: string;
  name: string;
  trigger_keyword: string | null;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface Workflow {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  steps: Array<{ trigger: string; action: string }>;
  is_active: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  merchant_id: string;
  category: string;
  title: string | null;
  body: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  merchant_id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  merchant_id: string;
  plan: string;
  status: string;
  message_count: number;
  message_limit: number;
  channel_count: number;
  channel_limit: number;
  ai_credits_used: number;
  ai_credits_limit: number;
  auto_renew: boolean;
  current_period_end: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  merchant_id: string;
  subject: string;
  body: string | null;
  status: string;
  priority: string;
  attachment_url: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  merchant_id: string;
  label: string | null;
  key_prefix: string | null;
  scopes: string[];
  last_used: string | null;
  is_active: boolean;
  created_at: string;
}
