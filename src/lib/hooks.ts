import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type {
  Conversation, Order, Product, Channel, Customer, Message,
  AiConfig, AutomationRule, Template, MerchantMember, Subscription, Workflow,
} from './types';

export function useMerchantData() {
  const { merchant } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<MerchantMember[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!merchant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = merchant.id;
    const [
      { data: convs }, { data: ords }, { data: prods }, { data: chs },
      { data: custs }, { data: ai }, { data: rules }, { data: tpls },
      { data: mems }, { data: sub }, { data: wfs },
    ] = await Promise.all([
      supabase.from('conversations').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('channels').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('ai_configs').select('*').eq('merchant_id', id).maybeSingle(),
      supabase.from('automation_rules').select('*').eq('merchant_id', id).order('priority', { ascending: false }),
      supabase.from('templates').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('merchant_members').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('merchant_id', id).maybeSingle(),
      supabase.from('workflows').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
    ]);
    setConversations(convs ?? []);
    setOrders(ords ?? []);
    setProducts(prods ?? []);
    setChannels(chs ?? []);
    setCustomers(custs ?? []);
    setAiConfig(ai as AiConfig | null);
    setAutomationRules(rules ?? []);
    setTemplates(tpls ?? []);
    setMembers(mems ?? []);
    setSubscription(sub as Subscription | null);
    setWorkflows((wfs ?? []) as Workflow[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [merchant?.id]);
  return { conversations, orders, products, channels, customers, aiConfig, automationRules, templates, members, subscription, workflows, loading, reload: loadAll };
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, content: string, sender: string, isAuto = false): Promise<void> {
  await supabase.from('messages').insert({ conversation_id: conversationId, content, sender, is_auto: isAuto });
  await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', conversationId);
}
