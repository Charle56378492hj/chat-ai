import { TelegramClient } from 'telegram';
import QRCode from 'qrcode';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { encryptSession, decryptSession } from './crypto.js';
import { env } from './env.js';
import { log, logError } from './logger.js';
import { supabase } from './supabase.js';
import { getSession, saveSession, updateChannel } from './store.js';
import { handleIncomingMessage } from './ai.js';

const sessions = new Map();

function emptySnapshot(channelId) {
  return {
    channel_id: channelId, status: 'idle', qr_value: null, qr_image: null, qr_expires_at: null,
    phone: null, username: null, display_name: null, last_error: null, connected_at: null,
  };
}

function snapshot(item) {
  const now = item.qrExpiresAt && item.qrExpiresAt < Date.now() ? null : item.qrValue;
  return {
    channel_id: item.channelId, status: item.status, qr_value: now,
    qr_image: now ? item.qrImage : null,
    qr_expires_at: item.qrExpiresAt ? new Date(item.qrExpiresAt).toISOString() : null,
    phone: item.phone, username: item.username, display_name: item.displayName,
    last_error: item.lastError, connected_at: item.connectedAt,
  };
}

function newClient(sessionString = '') {
  return new TelegramClient(new StringSession(sessionString), env.telegramApiId, env.telegramApiHash, {
    connectionRetries: 5,
    useWSS: true,
  });
}

async function updateStatus(item, status, patch = {}) {
  Object.assign(item, { status, ...patch });
  await saveSession(item.channelId, item.merchantId, {
    status,
    phone: item.phone,
    username: item.username,
    display_name: item.displayName,
    last_error: item.lastError,
    last_connected_at: item.connectedAt,
  });
}

async function attachIncomingHandler(item) {
  if (item.handlerAttached) return;
  item.handlerAttached = true;
  item.client.addEventHandler(async (event) => {
    try {
      // الرد التلقائي مخصص للمحادثات الخاصة. النشر للمجموعات/القنوات متاح
      // بشكل صريح عبر endpoint publish ولا يحصل بالصدفة من رسالة واردة.
      if (!event.isPrivate || !event.message?.message || event.message.out) return;
      const sender = await event.message.getSender();
      const displayName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || sender?.username || 'عميل تيليغرام';
      const chatId = String(event.chatId);
      await handleIncomingMessage({
        channel: item.channel,
        chatId,
        text: event.message.message.trim(),
        displayName,
        sendText: async (text) => {
          await item.client.sendMessage(event.chatId, { message: text });
        },
        sendPhoto: async (url, caption) => {
          await item.client.sendFile(event.chatId, { file: url, caption });
        },
      });
    } catch (error) {
      logError('events', `فشل معالجة رسالة للقناة ${item.channelId}`, error);
    }
  }, new NewMessage({ incoming: true }));
}

async function finishConnected(item, user) {
  item.client = item.client || newClient();
  const me = user || await item.client.getMe();
  item.phone = me?.phone ? `+${me.phone}` : null;
  item.username = me?.username || null;
  item.displayName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || null;
  item.connectedAt = item.connectedAt || new Date().toISOString();
  item.qrValue = null;
  item.qrImage = null;
  item.qrExpiresAt = null;
  await saveSession(item.channelId, item.merchantId, {
    status: 'connected',
    encrypted_session: encryptSession(item.client.session.save()),
    phone: item.phone,
    username: item.username,
    display_name: item.displayName,
    last_error: null,
    last_connected_at: item.connectedAt,
  });
  await updateChannel(item.channelId, {
    status: 'connected',
    name: item.username ? `تيليغرام — @${item.username}` : 'تيليغرام — حساب شخصي',
    config: { method: 'qr', username: item.username || '', phone: item.phone || '', display_name: item.displayName || '' },
    last_sync: new Date().toISOString(),
  });
  await attachIncomingHandler(item);
  item.status = 'connected';
  return snapshot(item);
}

async function beginQr(item) {
  item.status = 'starting';
  item.lastError = null;
  await saveSession(item.channelId, item.merchantId, { status: 'starting', last_error: null });
  await item.client.connect();
  item.status = 'qr';
  // GramJS keeps this promise pending until the QR is scanned and confirmed.
  item.loginPromise = item.client.signInUserWithQrCode(
    { apiId: env.telegramApiId, apiHash: env.telegramApiHash },
    {
      onError: async (error) => {
        item.lastError = error instanceof Error ? error.message : String(error);
        if (error?.errorMessage === 'PASSWORD_HASH_INVALID') {
          item.status = 'password_required';
          await saveSession(item.channelId, item.merchantId, {
            status: 'password_required',
            last_error: 'كلمة مرور التحقق بخطوتين غير صحيحة',
          });
          return false;
        }
        await saveSession(item.channelId, item.merchantId, { status: 'error', last_error: item.lastError });
        return true;
      },
      qrCode: async ({ token, expires }) => {
        const tokenValue = Buffer.from(token).toString('base64url');
        item.qrValue = `tg://login?token=${tokenValue}`;
        item.qrImage = await QRCode.toDataURL(item.qrValue, {
          errorCorrectionLevel: 'M', margin: 1, width: 240,
        });
        item.qrExpiresAt = expires * 1000;
        item.status = 'qr';
        await saveSession(item.channelId, item.merchantId, { status: 'qr', last_error: null });
      },
      password: async () => {
        item.status = 'password_required';
        item.lastError = null;
        await saveSession(item.channelId, item.merchantId, { status: 'password_required', last_error: null });
        return new Promise((resolve, reject) => {
          item.passwordWaiter = { resolve, reject };
        });
      },
    },
  ).then((user) => finishConnected(item, user))
    .catch(async (error) => {
      item.status = 'error';
      item.lastError = error instanceof Error ? error.message : String(error);
      await saveSession(item.channelId, item.merchantId, { status: 'error', last_error: item.lastError });
      logError('qr', `فشل تسجيل الدخول للقناة ${item.channelId}`, error);
      return snapshot(item);
    });
}

export async function startSession(channelId, channel, forceNewQr = false) {
  let item = sessions.get(channelId);
  if (item?.status === 'connected' && !forceNewQr) return snapshot(item);
  if (item?.loginPromise && !forceNewQr) return snapshot(item);

  const saved = await getSession(channelId);
  if (forceNewQr && item?.client) {
    await item.client.disconnect().catch(() => {});
    sessions.delete(channelId);
    item = null;
  }
  if (!forceNewQr && !item && saved?.encrypted_session) {
    try {
      const client = newClient(decryptSession(saved.encrypted_session));
      item = { channelId, merchantId: channel.merchant_id, channel, client, status: 'connecting',
        qrValue: null, qrExpiresAt: null, phone: saved.phone, username: saved.username,
        displayName: saved.display_name, lastError: null, connectedAt: saved.last_connected_at, qrImage: null };
      sessions.set(channelId, item);
      await client.connect();
      await finishConnected(item);
      return snapshot(item);
    } catch (error) {
      logError('resume', `تعذّر استئناف جلسة ${channelId}`, error);
      item = null;
      sessions.delete(channelId);
    }
  }
  if (!item) {
    item = { channelId, merchantId: channel.merchant_id, channel, client: newClient(),
      status: 'starting', qrValue: null, qrExpiresAt: null, phone: null, username: null,
      qrImage: null, displayName: null, lastError: null, connectedAt: null, handlerAttached: false };
    sessions.set(channelId, item);
  }
  if (forceNewQr) {
    await saveSession(channelId, channel.merchant_id, { status: 'starting', encrypted_session: null, last_error: null });
  }
  void beginQr(item);
  return snapshot(item);
}

export async function getSessionSnapshot(channelId) {
  const item = sessions.get(channelId);
  if (item) return snapshot(item);
  const saved = await getSession(channelId);
  if (!saved) return emptySnapshot(channelId);
  return {
    ...emptySnapshot(channelId),
    status: saved.status,
    phone: saved.phone,
    username: saved.username,
    display_name: saved.display_name,
    last_error: saved.last_error,
    connected_at: saved.last_connected_at,
  };
}

export async function logoutSession(channelId) {
  const item = sessions.get(channelId);
  item?.passwordWaiter?.reject(new Error('تم إلغاء تسجيل الدخول'));
  if (item?.client) await item.client.disconnect().catch(() => {});
  sessions.delete(channelId);
  const saved = await getSession(channelId);
  if (saved) await saveSession(channelId, saved.merchant_id, {
    status: 'logged_out', encrypted_session: null, last_error: null,
  });
  await updateChannel(channelId, { status: 'disconnected', config: { method: 'qr' } });
}

export async function submitPassword(channelId, password) {
  if (!password || password.length > 512) throw new Error('كلمة المرور غير صالحة');
  const item = sessions.get(channelId);
  if (!item?.passwordWaiter || item.status !== 'password_required') {
    throw new Error('لا توجد جلسة تنتظر كلمة مرور التحقق بخطوتين');
  }
  const waiter = item.passwordWaiter;
  item.passwordWaiter = null;
  item.status = 'connecting';
  waiter.resolve(password);
}

async function resolveEntity(client, to) {
  if (!to) throw new Error('المستلم مطلوب');
  return client.getInputEntity(to);
}

export async function sendText(channelId, to, text) {
  const item = sessions.get(channelId);
  if (!item || item.status !== 'connected') throw new Error('حساب تيليغرام غير متصل');
  const result = await item.client.sendMessage(await resolveEntity(item.client, to), { message: text });
  return String(result.id);
}

export async function publishText(channelId, to, text) {
  return sendText(channelId, to, text);
}

export async function resumeAllSessions() {
  const { data: rows, error } = await supabase.from('telegram_sessions').select('channel_id, merchant_id, status, encrypted_session, phone, username, display_name, last_connected_at').eq('status', 'connected');
  if (error) throw error;
  for (const row of rows || []) {
    const { data: channel } = await supabase.from('channels').select('id,merchant_id,type,name,status,config').eq('id', row.channel_id).eq('type', 'telegram').maybeSingle();
    if (!channel || !row.encrypted_session) continue;
    try {
      await startSession(row.channel_id, channel, false);
    } catch (error) {
      logError('resume', `فشل استئناف ${row.channel_id}`, error);
    }
  }
}

export function listSessions() {
  return [...sessions.values()].map((item) => ({ channel_id: item.channelId, status: item.status, username: item.username }));
}