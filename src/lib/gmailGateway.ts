import { supabase, supabaseProjectUrl } from './supabase';

export const GMAIL_FUNCTION_NAME = 'google-gmail';
export const GMAIL_FUNCTION_URL = supabaseProjectUrl
  ? `${supabaseProjectUrl}/functions/v1/${GMAIL_FUNCTION_NAME}`
  : '';

export interface GmailConnectionSummary {
  id: string;
  channel_id: string;
  email: string;
  google_user_id: string;
  scopes: string[];
  expires_at: string | null;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export interface GmailMessageSummary {
  id: string;
  thread_id: string | null;
  label_ids: string[];
  snippet: string;
  internal_date: string | null;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body_text?: string;
  body_html?: string | null;
}

interface GmailResponse {
  error?: string;
  [key: string]: unknown;
}

async function request<T extends GmailResponse>(body: Record<string, unknown>): Promise<T> {
  if (!GMAIL_FUNCTION_URL) throw new Error('رابط Gmail غير مضبوط. تحقق من VITE_SUPABASE_URL.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('انتهت جلسة الدخول. سجّل الدخول من جديد.');

  const response = await fetch(GMAIL_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok || payload.error) throw new Error(payload.error ?? 'تعذّر تنفيذ عملية Gmail.');
  return payload;
}

export function isGmailConfigured(): boolean {
  return Boolean(GMAIL_FUNCTION_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function startGmailAuthorization(returnTo = `${window.location.origin}/app/connections`): Promise<void> {
  const result = await request<{ authorization_url: string }>({ action: 'authorize', return_to: returnTo });
  if (!result.authorization_url) throw new Error('لم يتم إنشاء رابط Google OAuth.');
  window.location.assign(result.authorization_url);
}

export const getGmailConnection = () =>
  request<{ connected: boolean; connection: GmailConnectionSummary | null }>({ action: 'status' });

export const listGmailMessages = (options: { q?: string; maxResults?: number; pageToken?: string; labelId?: string } = {}) =>
  request<{ messages: GmailMessageSummary[]; next_page_token: string | null; result_size_estimate: number }>({
    action: 'list',
    q: options.q,
    max_results: options.maxResults ?? 25,
    page_token: options.pageToken,
    label_id: options.labelId ?? 'INBOX',
  });

export const getGmailMessage = (messageId: string) =>
  request<{ message: GmailMessageSummary & { body_text: string; body_html: string | null } }>({ action: 'get', message_id: messageId });

export const sendGmailMessage = (input: { to: string; cc?: string; bcc?: string; subject: string; body: string }) =>
  request<{ ok: true; message_id: string | null; thread_id: string | null }>({ action: 'send', ...input });

export const disconnectGmail = () => request<{ ok: true }>({ action: 'disconnect' });
