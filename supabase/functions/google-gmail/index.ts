import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/**
 * Gmail integration for the Connections page.
 *
 * The browser never receives a Google client secret or refresh token. OAuth is
 * completed here, and the refresh token is stored only in gmail_connections.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') ?? '';
const GOOGLE_OAUTH_STATE_SECRET = Deno.env.get('GOOGLE_OAUTH_STATE_SECRET') ?? '';
const PUBLIC_APP_URL = (Deno.env.get('PUBLIC_APP_URL') ?? '').replace(/\/$/, '');

const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GMAIL_SCOPES = [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, USERINFO_SCOPE];
const STATE_TTL_SECONDS = 10 * 60;
const MAX_LIST_RESULTS = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Json = Record<string, unknown>;
type GmailConnection = {
  id: string;
  merchant_id: string;
  channel_id: string;
  google_user_id: string;
  email: string;
  scopes: string[];
  expires_at: string | null;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
};

type OAuthState = {
  user_id: string;
  merchant_id: string;
  return_to: string;
  nonce: string;
  exp: number;
};

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string | null };
  parts?: GmailPart[];
};

type GmailApiMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: GmailHeader[];
    body?: { data?: string | null };
    parts?: GmailPart[];
  };
};

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'message' in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  if (data && typeof data === 'object' && 'error_description' in data) {
    const description = (data as { error_description?: unknown }).error_description;
    if (typeof description === 'string') return description;
  }
  return fallback;
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeUtf8Base64Url(value: string): string {
  return new TextDecoder().decode(base64UrlDecode(value));
}

async function hmac(value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(GOOGLE_OAUTH_STATE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}

async function createState(payload: OAuthState): Promise<string> {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${base64UrlEncode(await hmac(encoded))}`;
}

async function verifyState(value: string): Promise<OAuthState | null> {
  try {
    const [encoded, signature] = value.split('.');
    if (!encoded || !signature) return null;
    const expected = await hmac(encoded);
    if (!constantTimeEqual(expected, base64UrlDecode(signature))) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as OAuthState;
    if (!payload.user_id || !payload.merchant_id || !payload.return_to || !payload.nonce) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireConfig(): string | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return 'إعدادات Supabase ناقصة على الخادم.';
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return 'إعدادات Google OAuth ناقصة. أضف GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET وGOOGLE_REDIRECT_URI.';
  }
  if (!GOOGLE_OAUTH_STATE_SECRET) return 'المتغير GOOGLE_OAUTH_STATE_SECRET غير مضبوط على الخادم.';
  if (!PUBLIC_APP_URL) return 'المتغير PUBLIC_APP_URL غير مضبوط على الخادم.';
  return null;
}

function getAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authorization = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async function resolveMerchant(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: owned } = await admin
    .from('merchants')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  if (owned?.id) return owned.id as string;

  const { data: membership } = await admin
    .from('merchant_members')
    .select('merchant_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (membership?.merchant_id as string | undefined) ?? null;
}

function defaultReturnTo(): string {
  return `${PUBLIC_APP_URL}/app/connections`;
}

function safeReturnTo(candidate: unknown): string {
  const fallback = defaultReturnTo();
  if (typeof candidate !== 'string' || !candidate) return fallback;
  try {
    const requested = new URL(candidate);
    const allowed = new URL(PUBLIC_APP_URL);
    if (requested.origin !== allowed.origin) return fallback;
    if (!requested.pathname.startsWith('/app/')) return fallback;
    return requested.toString();
  } catch {
    return fallback;
  }
}

async function startAuthorization(req: Request): Promise<Response> {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'جلسة الدخول غير صالحة. سجّل الدخول من جديد.' }, 401);

  const body = (await req.json().catch(() => ({}))) as Json;
  const admin = getAdmin();
  const merchantId = await resolveMerchant(admin, user.id);
  if (!merchantId) return json({ error: 'تعذّر تحديد المتجر المرتبط بحسابك.' }, 400);

  const state = await createState({
    user_id: user.id,
    merchant_id: merchantId,
    return_to: safeReturnTo(body.return_to),
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });

  return json({ authorization_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}

async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) throw new Error(errorMessage(data, 'فشل إتمام تسجيل الدخول عبر Google.'));
  return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function googleUserInfo(accessToken: string): Promise<{ sub: string; email: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => null);
  const subject = data?.id ?? data?.sub;
  if (!response.ok || !subject || !data?.email) throw new Error('تعذّر قراءة بيانات حساب Google المختار.');
  return { sub: String(subject), email: String(data.email) };
}

async function finishAuthorization(req: Request): Promise<Response> {
  const setupError = requireConfig();
  if (setupError) return redirect(`${defaultReturnTo()}?gmail=error&reason=${encodeURIComponent(setupError)}`);
  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const googleError = url.searchParams.get('error');
  const fallback = defaultReturnTo();

  if (!state) return redirect(`${fallback}?gmail=error&reason=${encodeURIComponent('حالة OAuth مفقودة.')}`);
  const payload = await verifyState(state);
  if (!payload) return redirect(`${fallback}?gmail=error&reason=${encodeURIComponent('انتهت صلاحية جلسة الربط أو أصبحت غير صالحة.')}`);
  if (googleError) return redirect(`${payload.return_to}?gmail=error&reason=${encodeURIComponent('تم إلغاء الربط أو رفض الصلاحية من Google.')}`);
  if (!code) return redirect(`${payload.return_to}?gmail=error&reason=${encodeURIComponent('لم يصل رمز التفويض من Google.')}`);

  try {
    const admin = getAdmin();
    const tokens = await exchangeCode(code);
    const profile = await googleUserInfo(tokens.access_token);
    const { data: existing } = await admin
      .from('gmail_connections')
      .select('id, channel_id, refresh_token')
      .eq('merchant_id', payload.merchant_id)
      .maybeSingle();

    const refreshToken = tokens.refresh_token ?? existing?.refresh_token;
    if (!refreshToken) throw new Error('لم يعُد Google برمز التحديث. أعد المحاولة ووافق على الصلاحيات مرة أخرى.');

    let channelId = existing?.channel_id as string | undefined;
    const safeConfig = {
      method: 'oauth_google',
      provider: 'gmail',
      email: profile.email,
      google_user_id: profile.sub,
      scopes: GMAIL_SCOPES,
      connected_at: new Date().toISOString(),
    };

    if (channelId) {
      const { error } = await admin
        .from('channels')
        .update({ name: `Gmail — ${profile.email}`, status: 'connected', config: safeConfig, last_sync: new Date().toISOString() })
        .eq('id', channelId)
        .eq('merchant_id', payload.merchant_id);
      if (error) throw new Error(error.message);
    } else {
      const { data: existingChannel } = await admin
        .from('channels')
        .select('id')
        .eq('merchant_id', payload.merchant_id)
        .eq('type', 'email')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      channelId = existingChannel?.id as string | undefined;

      if (channelId) {
        const { error } = await admin
          .from('channels')
          .update({ name: `Gmail — ${profile.email}`, status: 'connected', config: safeConfig, last_sync: new Date().toISOString() })
          .eq('id', channelId)
          .eq('merchant_id', payload.merchant_id);
        if (error) throw new Error(error.message);
      } else {
        const { data: inserted, error } = await admin
          .from('channels')
          .insert({ merchant_id: payload.merchant_id, type: 'email', name: `Gmail — ${profile.email}`, status: 'connected', config: safeConfig, last_sync: new Date().toISOString() })
          .select('id')
          .single();
        if (error || !inserted?.id) throw new Error(error?.message ?? 'تعذّر إنشاء قناة Gmail.');
        channelId = inserted.id as string;
      }
    }

    const expiresAt = new Date(Date.now() + ((tokens.expires_in ?? 3600) * 1000)).toISOString();
    const { error: upsertError } = await admin.from('gmail_connections').upsert({
      ...(existing?.id ? { id: existing.id } : {}),
      merchant_id: payload.merchant_id,
      channel_id: channelId,
      google_user_id: profile.sub,
      email: profile.email,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_at: expiresAt,
      scopes: GMAIL_SCOPES,
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'merchant_id' });
    if (upsertError) throw new Error(upsertError.message);

    return redirect(`${payload.return_to}?gmail=connected&email=${encodeURIComponent(profile.email)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذّر إكمال ربط Gmail.';
    return redirect(`${payload.return_to}?gmail=error&reason=${encodeURIComponent(message)}`);
  }
}

async function getConnection(admin: SupabaseClient, merchantId: string): Promise<GmailConnection | null> {
  const { data, error } = await admin
    .from('gmail_connections')
    .select('id, merchant_id, channel_id, google_user_id, email, scopes, expires_at, last_sync, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GmailConnection | null) ?? null;
}

async function requireMerchant(req: Request): Promise<{ admin: SupabaseClient; merchantId: string } | Response> {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'جلسة الدخول غير صالحة. سجّل الدخول من جديد.' }, 401);
  const admin = getAdmin();
  const merchantId = await resolveMerchant(admin, user.id);
  if (!merchantId) return json({ error: 'تعذّر تحديد المتجر المرتبط بحسابك.' }, 400);
  return { admin, merchantId };
}

async function refreshAccessToken(admin: SupabaseClient, connection: GmailConnection & { refresh_token: string; access_token?: string | null }): Promise<string> {
  const expires = connection.expires_at ? Date.parse(connection.expires_at) : 0;
  if (connection.access_token && expires > Date.now() + 60_000) return connection.access_token;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    await admin.from('channels').update({ status: 'disconnected' }).eq('id', connection.channel_id).eq('merchant_id', connection.merchant_id);
    throw new Error('انتهت صلاحية ربط Gmail. اضغط إعادة الربط وسجّل الدخول عبر Google من جديد.');
  }

  const expiresAt = new Date(Date.now() + ((data.expires_in ?? 3600) * 1000)).toISOString();
  const { error } = await admin
    .from('gmail_connections')
    .update({ access_token: data.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('id', connection.id)
    .eq('merchant_id', connection.merchant_id);
  if (error) throw new Error(error.message);
  return String(data.access_token);
}

async function getConnectionWithSecret(admin: SupabaseClient, merchantId: string) {
  const { data, error } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('لا يوجد حساب Gmail مربوط بهذا المتجر.');
  return data as GmailConnection & { access_token?: string | null; refresh_token: string };
}

async function gmailRequest(path: string, accessToken: string, init?: RequestInit): Promise<Json> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, 'فشل الاتصال بـ Gmail API.'));
  return (data ?? {}) as Json;
}

function headersOf(message: GmailApiMessage): Record<string, string> {
  return Object.fromEntries((message.payload?.headers ?? []).map((header) => [String(header.name ?? '').toLowerCase(), String(header.value ?? '')]));
}

function bodyFromPart(part: GmailPart | undefined): { text: string; html: string } {
  if (!part) return { text: '', html: '' };
  const mime = String(part.mimeType ?? '').toLowerCase();
  const own = part.body?.data ? decodeUtf8Base64Url(part.body.data) : '';
  if (mime === 'text/plain' && own) return { text: own, html: '' };
  if (mime === 'text/html' && own) return { text: '', html: own };
  let text = '';
  let html = '';
  for (const child of part.parts ?? []) {
    const result = bodyFromPart(child);
    if (!text && result.text) text = result.text;
    if (!html && result.html) html = result.html;
  }
  return { text, html };
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeMessage(message: GmailApiMessage, includeBody = false): Json {
  const headers = headersOf(message);
  const result: Json = {
    id: message.id,
    thread_id: message.threadId ?? null,
    label_ids: message.labelIds ?? [],
    snippet: message.snippet ?? '',
    internal_date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    from: headers.from ?? '',
    to: headers.to ?? '',
    cc: headers.cc ?? '',
    subject: headers.subject ?? '(بدون موضوع)',
    date: headers.date ?? '',
  };
  if (includeBody) {
    const body = bodyFromPart(message.payload);
    result.body_text = body.text || htmlToText(body.html) || message.snippet || '';
    result.body_html = body.html || null;
  }
  return result;
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitEmails(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function standardBase64Encode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeMimeHeader(value: string): string {
  const cleaned = safeHeader(value);
  return /[^\x20-\x7E]/.test(cleaned)
    ? `=?UTF-8?B?${standardBase64Encode(cleaned)}?=`
    : cleaned;
}

function encodeMime(headers: Record<string, string>, body: string): string {
  const encodedHeaders = Object.entries(headers)
    .map(([key, value]) => `${key}: ${key.toLowerCase() === 'subject' ? encodeMimeHeader(value) : safeHeader(value)}`)
    .join('\r\n');
  const encodedBody = standardBase64Encode(body);
  const wrappedBody = encodedBody.match(/.{1,76}/g)?.join('\r\n') ?? '';
  const message = `${encodedHeaders}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrappedBody}`;
  return base64UrlEncode(new TextEncoder().encode(message));
}

async function listMessages(req: Request, admin: SupabaseClient, merchantId: string, body: Json): Promise<Response> {
  const connection = await getConnectionWithSecret(admin, merchantId);
  const accessToken = await refreshAccessToken(admin, connection);
  const requestedResults = Number(body.max_results ?? 25);
  const maxResults = Number.isFinite(requestedResults)
    ? Math.min(Math.max(Math.floor(requestedResults), 1), MAX_LIST_RESULTS)
    : 25;
  const params = new URLSearchParams({ maxResults: String(maxResults), labelIds: String(body.label_id ?? 'INBOX') });
  if (typeof body.page_token === 'string' && body.page_token) params.set('pageToken', body.page_token);
  if (typeof body.q === 'string' && body.q.trim()) params.set('q', body.q.trim());

  const list = await gmailRequest(`messages?${params.toString()}`, accessToken);
  const references = Array.isArray(list.messages) ? (list.messages as Json[]) : [];
  const messages = await Promise.all(references.slice(0, maxResults).map(async (reference) => {
    const item = await gmailRequest(`messages/${encodeURIComponent(String(reference.id))}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, accessToken);
    return normalizeMessage(item as unknown as GmailApiMessage);
  }));
  await admin.from('gmail_connections').update({ last_sync: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', connection.id);
  return json({ messages, next_page_token: list.nextPageToken ?? null, result_size_estimate: list.resultSizeEstimate ?? messages.length });
}

async function getMessage(admin: SupabaseClient, merchantId: string, messageId: string): Promise<Response> {
  if (!messageId || !/^[a-zA-Z0-9_-]+$/.test(messageId)) return json({ error: 'معرّف الرسالة غير صالح.' }, 400);
  const connection = await getConnectionWithSecret(admin, merchantId);
  const accessToken = await refreshAccessToken(admin, connection);
  const message = await gmailRequest(`messages/${encodeURIComponent(messageId)}?format=full`, accessToken);
  return json({ message: normalizeMessage(message as unknown as GmailApiMessage, true) });
}

async function sendMessage(admin: SupabaseClient, merchantId: string, body: Json): Promise<Response> {
  const to = splitEmails(String(body.to ?? ''));
  const cc = splitEmails(String(body.cc ?? ''));
  const bcc = splitEmails(String(body.bcc ?? ''));
  const subject = safeHeader(String(body.subject ?? ''));
  const content = String(body.body ?? '').trim();
  if (!to.length || to.some((email) => !validEmail(email))) return json({ error: 'أدخل بريدًا مستلمًا صحيحًا.' }, 400);
  if (cc.some((email) => !validEmail(email)) || bcc.some((email) => !validEmail(email))) return json({ error: 'تحقق من عناوين CC وBCC.' }, 400);
  if (!subject) return json({ error: 'موضوع الرسالة مطلوب.' }, 400);
  if (!content) return json({ error: 'محتوى الرسالة مطلوب.' }, 400);
  if (content.length > 100_000) return json({ error: 'محتوى الرسالة طويل جدًا.' }, 400);

  const connection = await getConnectionWithSecret(admin, merchantId);
  const accessToken = await refreshAccessToken(admin, connection);
  const headers: Record<string, string> = {
    To: to.join(', '),
    Subject: subject,
  };
  if (cc.length) headers.Cc = cc.join(', ');
  if (bcc.length) headers.Bcc = bcc.join(', ');
  const result = await gmailRequest('messages/send', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeMime(headers, content) }),
  });
  await admin.from('gmail_connections').update({ last_sync: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', connection.id);
  return json({ ok: true, message_id: result.id ?? null, thread_id: result.threadId ?? null });
}

async function disconnect(admin: SupabaseClient, merchantId: string): Promise<Response> {
  const connection = await getConnectionWithSecret(admin, merchantId);
  if (connection.access_token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.access_token)}`, { method: 'POST' }).catch(() => undefined);
  }
  const { error } = await admin.from('gmail_connections').delete().eq('merchant_id', merchantId);
  if (error) throw new Error(error.message);
  await admin.from('channels').update({ status: 'disconnected' }).eq('id', connection.channel_id).eq('merchant_id', merchantId);
  return json({ ok: true });
}

async function handleApi(req: Request): Promise<Response> {
  const setupError = requireConfig();
  if (setupError) return json({ error: setupError }, 500);
  const body = (await req.json().catch(() => ({}))) as Json;
  const action = String(body.action ?? '');
  if (action === 'authorize') return startAuthorization(req);

  const context = await requireMerchant(req);
  if (context instanceof Response) return context;
  const { admin, merchantId } = context;

  try {
    if (action === 'status') {
      const connection = await getConnection(admin, merchantId);
      return json({ connected: Boolean(connection), connection });
    }
    if (action === 'list') return listMessages(req, admin, merchantId, body);
    if (action === 'get') return getMessage(admin, merchantId, String(body.message_id ?? ''));
    if (action === 'send') return sendMessage(admin, merchantId, body);
    if (action === 'disconnect') return disconnect(admin, merchantId);
    return json({ error: 'الإجراء غير مدعوم.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع في Gmail.' }, 500);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method === 'GET') return finishAuthorization(req);
    if (req.method !== 'POST') return json({ error: 'الطريقة غير مدعومة.' }, 405);
    return await handleApi(req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع.' }, 500);
  }
});
