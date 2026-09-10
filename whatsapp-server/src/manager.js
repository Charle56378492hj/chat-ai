// ─────────────────────────────────────────────────────────────────────────────
// مدير جلسات واتساب (Baileys) — محسّن
//
// التحسينات:
//  • توليد QR يدوي فقط عند الضغط (بدل تلقائي)
//  • استقرار أفضل في الاتصال
//  • معالجة أخطاء أكثر وضوحًا
//  • تخزين محلي للجلسات كنسخة احتياطية
// ─────────────────────────────────────────────────────────────────────────────
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
  Browsers,
} from 'baileys';
import QRCode from 'qrcode';

import { useSupabaseAuthState } from './authState.js';
import { waLogger, log, logError } from './logger.js';
import { getWhatsAppChannel, listResumableChannels, saveSessionState, setChannelStatus, notify } from './store.js';
import { handleIncomingMessage } from './inbound.js';

/** @type {Map<string, any>} */
const sessions = new Map();

// إعدادات الاتصال المحسّنة
const MAX_BACKOFF_MS = 30_000;
const QR_MAX_ATTEMPTS = 5;
const QR_TIMEOUT_MS = 65_000; // 65 ثانية لكل QR
const CONNECTION_TIMEOUT_MS = 90_000;
const MAX_RECONNECT_ATTEMPTS = 15;

function emptySession(channelId, merchantId) {
  return {
    channelId,
    merchantId,
    sock: null,
    status: 'idle',
    qr: null,
    qrImage: null,
    qrExpiresAt: null,
    qrAttempts: 0,
    phone: null,
    lastError: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    stopped: false,
    starting: false,
    auth: null,
    qrRequestedAt: null,
    lastConnectionError: null,
  };
}

export function getSessionSnapshot(channelId) {
  const s = sessions.get(channelId);
  if (!s) return { status: 'idle', qr: null, qr_image: null, phone: null, last_error: null };
  return {
    status: s.status,
    qr: s.status === 'qr' ? s.qr : null,
    qr_image: s.status === 'qr' ? s.qrImage : null,
    qr_expires_at: s.status === 'qr' ? s.qrExpiresAt : null,
    phone: s.phone,
    last_error: s.lastError,
    reconnect_attempts: s.reconnectAttempts,
  };
}

function clearReconnectTimer(session) {
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
}

function scheduleReconnect(session, reason) {
  if (session.stopped) return;
  
  // إذا تجاوزنا الحد الأقصى من محاولات إعادة الاتصال، نتوقف
  if (session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    log('manager', `توقفنا عن إعادة محاولة ${session.channelId} (${MAX_RECONNECT_ATTEMPTS} محاولات)`);
    session.stopped = true;
    return;
  }

  clearReconnectTimer(session);
  session.reconnectAttempts += 1;
  const delay = Math.min(1500 * 2 ** (session.reconnectAttempts - 1), MAX_BACKOFF_MS);
  
  log('manager', `إعادة اتصال ${session.channelId} بعد ${delay}ms (محاولة ${session.reconnectAttempts}) — السبب: ${reason}`);
  
  session.reconnectTimer = setTimeout(() => {
    startSession(session.channelId, { merchantId: session.merchantId }).catch((e) =>
      logError('manager', 'فشل إعادة الاتصال', e)
    );
  }, delay);
}

async function closeSocket(session) {
  const sock = session.sock;
  session.sock = null;
  if (!sock) return;
  try {
    sock.ev.removeAllListeners('connection.update');
    sock.ev.removeAllListeners('creds.update');
    sock.ev.removeAllListeners('messages.upsert');
    sock.ws?.close();
  } catch {
    /* السوكيت مسكّر أصلًا */
  }
}

/**
 * بدء جلسة واتساب أو توليد QR جديد
 * @param {string} channelId
 * @param {{ merchantId?: string, forceNewQr?: boolean }} options
 */
export async function startSession(channelId, options = {}) {
  let session = sessions.get(channelId);
  if (!session) {
    session = emptySession(channelId, options.merchantId ?? null);
    sessions.set(channelId, session);
  }

  // طلب QR جديد — نصفّر البيانات القديمة
  if (session.stopped || options.forceNewQr) {
    session.qrAttempts = 0;
    session.reconnectAttempts = 0;
    session.lastError = null;
    session.lastConnectionError = null;
  }
  
  session.stopped = false;
  if (options.merchantId) session.merchantId = options.merchantId;

  // منفتح جلسة واحدة فقط لكل قناة
  if (session.starting) return getSessionSnapshot(channelId);
  if (session.sock && (session.status === 'connected' || session.status === 'qr') && !options.forceNewQr) {
    return getSessionSnapshot(channelId);
  }

  session.starting = true;
  session.qrRequestedAt = new Date();
  clearReconnectTimer(session);

  try {
    const channel = await getWhatsAppChannel(channelId);
    if (!channel) {
      session.starting = false;
      session.lastError = 'القناة غير موجودة';
      throw new Error('القناة غير موجودة أو ليست قناة واتساب');
    }
    session.merchantId = channel.merchant_id;

    const auth = await useSupabaseAuthState(channelId);
    session.auth = auth;

    // طلب QR جديد من الصفر → نمسح أي بقايا جلسة قديمة
    if (options.forceNewQr && !auth.state.creds.registered) {
      log('manager', `مسح جلسة قديمة لـ ${channelId} قبل توليد QR جديد`);
      await auth.clearAuthState();
      const fresh = await useSupabaseAuthState(channelId);
      session.auth = fresh;
    }

    await closeSocket(session);

    const activeAuth = session.auth;
    
    // جلب أحدث نسخة من بروتوكول واتساب ويب
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
      log('manager', `استخدام نسخة واتساب: ${version?.version ?? 'افتراضية'}`);
    } catch (e) {
      logError('manager', 'تعذّر جلب نسخة واتساب، سنكمل بالنسخة الافتراضية', e);
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      logger: waLogger,
      auth: {
        creds: activeAuth.state.creds,
        keys: makeCacheableSignalKeyStore(activeAuth.state.keys, waLogger),
      },
      browser: Browsers.appropriate('Desktop'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: CONNECTION_TIMEOUT_MS,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 1_000,
      qrTimeout: QR_TIMEOUT_MS, // 65 ثانية
      emitOwnEvents: false,
      shouldIgnoreJid: (jid) =>
        typeof jid === 'string' && (jid.endsWith('@broadcast') || jid.endsWith('@newsletter')),
    });

    session.sock = sock;
    session.status = 'connecting';
    session.lastError = null;
    await saveSessionState(channelId, session.merchantId, { status: 'connecting' });

    sock.ev.on('creds.update', () => {
      activeAuth.saveCreds().catch((e) => logError('manager', 'فشل حفظ بيانات الجلسة', e));
    });

    sock.ev.on('connection.update', (update) => {
      handleConnectionUpdate(session, update).catch((e) =>
        logError('manager', 'خطأ بمعالجة تحديث الاتصال', e)
      );
    });

    sock.ev.on('messages.upsert', (event) => {
      if (event.type !== 'notify') return;
      for (const message of event.messages ?? []) {
        handleIncomingMessage(session, message).catch((e) =>
          logError('manager', 'خطأ بمعالجة رسالة واردة', e)
        );
      }
    });

    return getSessionSnapshot(channelId);
  } catch (e) {
    session.lastError = e instanceof Error ? e.message : 'خطأ غير معروف';
    logError('manager', `فشل بدء الجلسة ${channelId}`, e);
    throw e;
  } finally {
    session.starting = false;
  }
}

async function handleConnectionUpdate(session, update) {
  const { connection, lastDisconnect, qr } = update;
  const channelId = session.channelId;

  // ── QR جديد ────────────────────────────────────────────────────────────────
  if (qr) {
    session.qrAttempts += 1;
    session.qr = qr;
    
    // تولد الصورة على السيرفر
    try {
      session.qrImage = await QRCode.toDataURL(qr);
      const expiresAt = new Date(Date.now() + 65_000); // 65 ثانية
      session.qrExpiresAt = expiresAt.toISOString();
      session.status = 'qr';
      session.lastError = null;

      log('manager', `QR جديد لـ ${channelId} (محاولة ${session.qrAttempts}/${QR_MAX_ATTEMPTS})`);

      await saveSessionState(channelId, session.merchantId, {
        status: 'qr',
        qr_expires_at: expiresAt.toISOString(),
      });
    } catch (e) {
      logError('manager', 'فشل توليد صورة QR', e);
      session.lastError = 'فشل توليد صورة QR';
    }
    return;
  }

  // ── QR انتهت صلاحيته ──────────────────────────────────────────────────────
  if (qr === null && session.status === 'qr') {
    if (session.qrAttempts >= QR_MAX_ATTEMPTS) {
      session.status = 'disconnected';
      session.lastError = `انتهت صلاحية QR (${QR_MAX_ATTEMPTS} محاولات). اضغط "توليد رمز جديد".`;
      log('manager', `انتهت محاولات QR لـ ${channelId}`);
      await closeSocket(session);
      return;
    }
  }

  // ── اتصال ناجح ────────────────────────────────────────────────────────────
  if (connection === 'open') {
    const phone = jidNormalizedUser(session.sock?.user?.id).split('@')[0];
    const jid = session.sock?.user?.id;
    const wasReconnect = session.status === 'connected';

    session.status = 'connected';
    session.reconnectAttempts = 0;
    session.qr = null;
    session.qrImage = null;
    session.phone = phone;
    session.lastError = null;

    log('manager', `✅ اتصال واتساب ناجح للقناة ${channelId} — ${phone}`);

    await saveSessionState(channelId, session.merchantId, {
      status: 'connected',
      phone_number: phone,
      jid,
      last_connected_at: new Date().toISOString(),
      last_disconnect_reason: null,
    });
    await setChannelStatus(channelId, 'connected', {
      method: 'qr',
      provider: 'baileys',
      phone_number: phone ?? '',
      jid: jid ?? '',
      connected_at: new Date().toISOString(),
    });

    if (!wasReconnect) {
      await notify(session.merchantId, channelId, {
        level: 'success',
        title: 'تم ربط واتساب بنجاح ✅',
        message: `الرقم ${phone ?? ''} صار متصل وجاهز لاستقبال الرسائل.`,
      });
    }
    return;
  }

  // ── انقطع الاتصال ──────────────────────────────────────────────────────────
  if (connection === 'close') {
    const error = lastDisconnect?.error;
    const statusCode = error?.output?.statusCode ?? error?.output?.payload?.statusCode ?? null;
    const reasonText = error?.message ?? 'سبب غير معروف';

    session.lastConnectionError = reasonText;

    // تسجيل خروج فعلي
    const isLoggedOut =
      statusCode === DisconnectReason.loggedOut ||
      statusCode === DisconnectReason.badSession ||
      statusCode === DisconnectReason.forbidden ||
      statusCode === 401 ||
      statusCode === 403;

    if (isLoggedOut) {
      log('manager', `القناة ${channelId} سجّلت خروج (${statusCode}) — نحتاج ربط جديد`);
      session.stopped = true;
      session.status = 'logged_out';
      session.qr = null;
      session.qrImage = null;
      session.phone = null;
      session.lastError = 'تم إلغاء ربط الجهاز من تطبيق واتساب. أعد الربط بمسح رمز QR جديد.';
      await closeSocket(session);
      await session.auth?.clearAuthState();
      await saveSessionState(channelId, session.merchantId, {
        status: 'logged_out',
        last_disconnect_reason: `logged_out (${statusCode})`,
        phone_number: null,
        jid: null,
      });
      await setChannelStatus(channelId, 'disconnected');
      await notify(session.merchantId, channelId, {
        level: 'error',
        title: 'انفصل واتساب ❌',
        message: 'تم إلغاء ربط الجهاز من تطبيق واتساب. افتح صفحة القنوات وأعد الربط بمسح رمز QR جديد.',
      });
      return;
    }

    // انتهاء مهلة QR
    if (statusCode === DisconnectReason.timedOut && session.status === 'qr') {
      session.status = 'disconnected';
      session.lastError = 'انتهت صلاحية رمز QR. اضغط "توليد رمز جديد".';
      await closeSocket(session);
      return;
    }

    // انقطاع مؤقت → نعيد المحاولة
    session.status = 'disconnected';
    session.lastError = reasonText;
    await closeSocket(session);
    await saveSessionState(channelId, session.merchantId, {
      status: 'disconnected',
      last_disconnect_reason: `${statusCode ?? 'unknown'}: ${reasonText}`.slice(0, 300),
    });

    // الجلسات المسجّلة نعيد محاولة الاتصال فيها للأبد
    const registered = Boolean(session.auth?.state?.creds?.registered);
    if (!registered && session.reconnectAttempts >= 5) {
      session.stopped = true;
      log('manager', `توقفنا عن إعادة محاولة قناة غير مربوطة ${channelId}`);
      return;
    }

    // بعد 10 محاولات فاشلة
    if (registered && session.reconnectAttempts === 10) {
      await notify(session.merchantId, channelId, {
        level: 'warning',
        title: 'واتساب يحاول إعادة الاتصال',
        message: `انقطع الاتصال بواتساب ونحن نعيد المحاولة تلقائيًا. آخر خطأ: ${reasonText}`,
      });
    }

    scheduleReconnect(session, `${statusCode ?? 'unknown'}`);
  }
}

/** فصل يدوي كامل + مسح الجلسة */
export async function logoutSession(channelId) {
  const session = sessions.get(channelId);
  if (session) {
    session.stopped = true;
    clearReconnectTimer(session);
    try {
      await session.sock?.logout();
    } catch {
      /* مقطوع أصلًا */
    }
    await closeSocket(session);
    await session.auth?.clearAuthState();
    session.status = 'logged_out';
    session.phone = null;
    session.qr = null;
    session.qrImage = null;
  } else {
    const auth = await useSupabaseAuthState(channelId);
    await auth.clearAuthState();
  }

  const merchantId = session?.merchantId ?? (await getWhatsAppChannel(channelId))?.merchant_id ?? null;
  await saveSessionState(channelId, merchantId, {
    status: 'logged_out',
    phone_number: null,
    jid: null,
    last_disconnect_reason: 'manual_logout',
  });
  await setChannelStatus(channelId, 'disconnected');
  sessions.delete(channelId);
  return { ok: true };
}

/** إرسال رسالة نصية */
export async function sendText(channelId, to, text) {
  const session = sessions.get(channelId);
  if (!session?.sock || session.status !== 'connected') {
    throw new Error('واتساب غير متصل حاليًا لهذه القناة');
  }
  const jid = toJid(to);
  await session.sock.presenceSubscribe(jid).catch(() => {});
  await session.sock.sendPresenceUpdate('composing', jid).catch(() => {});
  const result = await session.sock.sendMessage(jid, { text });
  await session.sock.sendPresenceUpdate('paused', jid).catch(() => {});
  return result?.key?.id ?? null;
}

/** إرسال صورة */
export async function sendImage(channelId, to, imageUrl, caption) {
  const session = sessions.get(channelId);
  if (!session?.sock || session.status !== 'connected') {
    throw new Error('واتساب غير متصل حاليًا لهذه القناة');
  }
  const jid = toJid(to);
  const result = await session.sock.sendMessage(jid, {
    image: { url: imageUrl },
    caption: caption?.slice(0, 900) ?? undefined,
  });
  return result?.key?.id ?? null;
}

export function toJid(value) {
  if (typeof value === 'string' && value.includes('@')) return value;
  const digits = String(value ?? '').replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/** استرجاع الجلسات المحفوظة عند الإقلاع */
export async function resumeAllSessions() {
  const channels = await listResumableChannels();
  if (!channels.length) {
    log('manager', 'ما في جلسات واتساب محفوظة للاسترجاع');
    return;
  }
  log('manager', `استرجاع ${channels.length} جلسة واتساب محفوظة…`);
  for (const { channelId, merchantId } of channels) {
    try {
      const auth = await useSupabaseAuthState(channelId);
      if (!auth.state.creds?.registered) {
        log('manager', `تجاهل ${channelId} — ما في جلسة مكتملة محفوظة`);
        continue;
      }
      await startSession(channelId, { merchantId });
    } catch (e) {
      logError('manager', `فشل استرجاع الجلسة ${channelId}`, e);
    }
    // توزيع الاتصالات بدل دفعة واحدة
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/** فحص دوري للجلسات المتوقفة */
export function startWatchdog() {
  setInterval(() => {
    for (const session of sessions.values()) {
      if (session.stopped || session.starting) continue;
      const registered = Boolean(session.auth?.state?.creds?.registered);
      const needsRevive =
        registered && session.status !== 'connected' && session.status !== 'qr' && !session.reconnectTimer;
      if (needsRevive) {
        log('watchdog', `إحياء جلسة متوقفة ${session.channelId}`);
        scheduleReconnect(session, 'watchdog');
      }
    }
  }, 60_000).unref?.();
}

export function listSessions() {
  return Array.from(sessions.values()).map((s) => ({
    channel_id: s.channelId,
    status: s.status,
    phone: s.phone,
  }));
}
