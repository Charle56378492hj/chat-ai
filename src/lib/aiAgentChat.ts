import { supabase } from './supabase';
import type { AiAgentAction, AiAgentConversation, AiAgentMessage, AiAgentSchedule } from './types';

export interface AgentChatResult {
  conversation_id: string;
  message: string;
  actions: Array<{ tool: string; args: Record<string, unknown>; status: 'completed' | 'failed'; error: string | null; read_only: boolean }>;
}

/** يرسل رسالة التاجر إلى دماغ AI Command Center (ai-agent-chat) وينفّذ أي أدوات لازمة سيرفرياً. */
export async function sendAgentChatMessage(message: string, conversationId?: string | null): Promise<AgentChatResult> {
  const { data, error } = await supabase.functions.invoke('ai-agent-chat', {
    body: { message, conversation_id: conversationId ?? null },
  });
  if (error) throw new Error(error.message || 'تعذّر الاتصال بالوكيل.');
  if (data?.error) throw new Error(data.error as string);
  if (!data?.ok) throw new Error('رد غير متوقع من الخادم.');
  return data as AgentChatResult;
}

export async function listAgentConversations(merchantId: string): Promise<AiAgentConversation[]> {
  const { data, error } = await supabase
    .from('ai_agent_conversations')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AiAgentConversation[];
}

export async function loadAgentMessages(conversationId: string): Promise<AiAgentMessage[]> {
  const { data, error } = await supabase
    .from('ai_agent_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiAgentMessage[];
}

export async function listAgentActivity(merchantId: string, limit = 50): Promise<AiAgentAction[]> {
  const { data, error } = await supabase
    .from('ai_agent_actions')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AiAgentAction[];
}

export async function listAgentSchedules(merchantId: string): Promise<AiAgentSchedule[]> {
  const { data, error } = await supabase
    .from('ai_agent_schedules')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AiAgentSchedule[];
}

export async function setAgentScheduleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('ai_agent_schedules').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function deleteAgentSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('ai_agent_schedules').delete().eq('id', id);
  if (error) throw error;
}
