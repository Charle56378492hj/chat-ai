// ─────────────────────────────────────────────────────────────────────────────
// مدير جلسات واتساب (Baileys)
//
// مسؤول عن:
//  • فتح اتصال واتساب لكل قناة وتوليد QR حقيقي يقبله تطبيق واتساب
//  • إعادة الاتصال تلقائيًا عند أي انقطاع (شبكة / إعادة تشغيل / 515 …)
//  • استرجاع الجلسات المحفوظة عند إقلاع السيرفر → الزبون ما بيعيد المسح أبدًا
//  • إشعار التاجر عند الفصل الحقيقي (تسجيل خروج من الهاتف / حظر)
//  • تمرير الرسائل الواردة للمعالجة والرد
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

// أقصى مهلة بين محاولات إعادة الاتصال (30 ثانية) — نبدأ بسرعة وبنتدرّج
// حتى ما نغرق سيرفرات واتساب ولا ننحظر.
const MAX_BACKOFF_MS = 30_000;
const QR_MAX_ATTEMPTS = 5; // ~5 أكواد × 60 ثانية = 5 دقائق للمسح

function emptySession(channelId, merchantId) {
  return {
    channelId,
    merchantId,
    sock: null,
    status: 'idle',       // idle | connecting | qr | connected | disconnected | logged_out
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
  clearReconnectTimer(session);
  session.reconnectAttempts += 1;
  const delay = Math.min(1500 * 2 ** (session.reconnectAttempts - 1), MAX_BACKOFF_MS);
  log('manager', `إعادة اتصال ${session.channelId} بعد ${delay}ms (السبب: ${reason})`);
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
 * يفتح (أو يعيد فتح) جلسة واتساب لقناة معيّنة.
 * @param {string} channelId
 * @param {{ merchantId?: string, forceNewQr?: boolean }} options
 */
export async function startSession(channelId, options = {}) {
  let session = sessions.get(channelId);
  if (!session) {
    session = emptySession(channelId, options.merchantId ?? null);
    sessions.set(channelId, session);
  }
  session.stopped = false;
  if (options.merchantId) session.merchantId = options.merchantId;

  // ما منفتح أكتر من سوكيت للقناة الواحدة — تعدد السوكيتات بنفس الجلسة هو
  // السبب الكلاسيكي لرسائل "conflict / stream errored" والفصل المتكرر.
  if (session.starting) return getSessionSnapshot(channelId);
  if (session.sock && (session.status === 'connected' || session.status === 'qr') && !options.forceNewQr) {
    return getSessionSnapshot(channelId);
  }

  session.starting = true;
  clearReconnectTimer(session);

  try {
    const channel = await getWhatsAppChannel(channelId);
    if (!channel) {
      session.starting = false;
      throw new Error('القناة غير موجودة أو ليست قناة واتساب');
    }
    session.merchantId = channel.merchant_id;

    const auth = await useSupabaseAuthState(channelId);
    session.auth = auth;

    // طلب QR جديد من الصفر → نمسح أي بقايا جلسة قديمة، لأن محاولة الربط
    // ببيانات قديمة/تالفة هي أكثر سبب يخلي واتساب "ما يقبل" مسح الكود.
    if (options.forceNewQr && !auth.state.creds.registered) {
      await auth.clearAuthState();
      const fresh = await useSupabaseAuthState(channelId);
      session.auth = fresh;
    }

    await closeSocket(session);

    const activeAuth = session.auth;
    // نستخدم دايمًا آخر نسخة من بروتوكول واتساب ويب. النسخة القديمة = واتساب
    // يرفض الـ QR أو يفصل فورًا بعد المسح.
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (e) {
      logError('manager', 'تعذّر جلب نسخة واتساب، سنكمل بالنسخة الافتراضية', e);
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      logger: waLogger,
      auth: {
        creds: activeAuth.state.creds,
        // التخزين المؤقت للمفاتيح يسرّع التشفير كثيرًا ويمنع تأخير الرد
        keys: makeCacheableSignalKeyStore(activeAuth.state.keys, waLogger),
      },
      // اسم الجهاز يلي رح يظهر بـ "الأجهزة المرتبطة" داخل تطبيق واتساب
      browser: Browsers.appropriate('Desktop'),
      printQRInTerminal: false,
      syncFullHistory: false,          // ما منحمّل كل تاريخ المحادثات (بطيء وثقيل)
      markOnlineOnConnect: false,      // حتى تبقى إشعارات هاتف الزبون شغالة
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,     // نبض دائم يمنع الفصل الصامت
      retryRequestDelayMs: 1_000,
      qrTimeout: 60_000,
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
    // نولّد الصورة هون بالسيرفر بدل ما نعتمد على خدمة QR خارجية بالمتصفح.
    // الاعتماد على خدمة خارجية كان يشوّه الكود الطويل → واتساب ما بيقبله.
    session.qrImage = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: 'L', // واتساب نفسه بيستخدم L؛ يخلي الكود أوضح وأسهل بالمسح
      margin: 2,
      scale: 8,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    session.qrExpiresAt = new Date(Date.now() + 60_000).toISOString();
    session.status = 'qr';
    await saveSessionState(channelId, session.merchantId, { status: 'qr' });
    log('manager', `QR جاهز للقناة ${channelId} (محاولة ${session.qrAttempts})`);

    // بعد عدة أكواد بدون مسح منوقف مؤقتًا بدل ما نضل ندور للأبد.
    if (session.qrAttempts >= QR_MAX_ATTEMPTS) {
      log('manager', `انتهت مهلة مسح QR للقناة ${channelId}`);
      session.stopped = true;
      session.status = 'disconnected';
      session.lastError = 'انتهت مهلة مسح رمز QR. اضغط "توليد رمز جديد" وحاول مجددًا.';
      await closeSocket(session);
      await saveSessionState(channelId, session.merchantId, {
        status: 'disconnected',
        last_disconnect_reason: 'qr_timeout',
      });
    }
    return;
  }

  // ── تم الاتصال ─────────────────────────────────────────────────────────────
  if (connection === 'open') {
    const jid = session.sock?.user?.id ? jidNormalizedUser(session.sock.user.id) : null;
    const phone = jid ? jid.split('@')[0] : null;
    const wasReconnect = session.reconnectAttempts > 0;

    session.status = 'connected';
    session.qr = null;
    session.qrImage = null;
    session.qrAttempts = 0;
    session.reconnectAttempts = 0;
    session.lastError = null;
    session.phone = phone;

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
        title: 'تم ربط واتساب بنجاح',
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

    // تسجيل خروج فعلي: الزبون شال الجهاز من واتساب، أو واتساب رفض الجلسة.
    // بهي الحالة إعادة المحاولة بنفس البيانات ما رح تنفع أبدًا — لازم QR جديد.
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
        title: 'انفصل واتساب',
        message: 'تم إلغاء ربط الجهاز من تطبيق واتساب. افتح صفحة القنوات وأعد الربط بمسح رمز QR جديد.',
      });
      return;
    }

    // انتهاء مهلة الـ QR بدون مسح — ما منعتبره خطأ ولا منعيد المحاولة.
    if (statusCode === DisconnectReason.timedOut && session.status === 'qr') {
      session.status = 'disconnected';
      session.lastError = 'انتهت صلاحية رمز QR. اضغط "توليد رمز جديد".';
      await closeSocket(session);
      return;
    }

    // أي سبب تاني (شبكة، restartRequired 515، connectionLost/Replaced …) =
    // انقطاع مؤقت → نرجع نتصل تلقائيًا بدون أي تدخّل من الزبون.
    session.status = 'disconnected';
    session.lastError = reasonText;
    await closeSocket(session);
    await saveSessionState(channelId, session.merchantId, {
      status: 'disconnected',
      last_disconnect_reason: `${statusCode ?? 'unknown'}: ${reasonText}`.slice(0, 300),
    });

    // إذا الجلسة مسجّلة (يعني كانت مربوطة فعلًا) منعيد المحاولة للأبد.
    // إذا لسا ما انربطت، منوقف بعد محاولات محدودة حتى ما ندور بالفراغ.
    const registered = Boolean(session.auth?.state?.creds?.registered);
    if (!registered && session.reconnectAttempts >= 5) {
      session.stopped = true;
      log('manager', `توقفنا عن إعادة محاولة قناة غير مربوطة ${channelId}`);
      return;
    }

    // بعد 10 محاولات فاشلة متتالية منبلّغ التاجر إنو في مشكلة مستمرة،
    // بس منضل نحاول بالخلفية.
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

/** فصل يدوي كامل + مسح الجلسة (الزبون طلب فصل الحساب) */
export async function logoutSession(channelId) {
  const session = sessions.get(channelId);
  if (session) {
    session.stopped = true;
    clearReconnectTimer(session);
    try {
      await session.sock?.logout();
    } catch {
      /* ممكن يكون الاتصال مقطوع أصلًا */
    }
    await closeSocket(session);
    await session.auth?.clearAuthState();
    session.status = 'logged_out';
    session.phone = null;
    session.qr = null;
    session.qrImage = null;
  } else {
    // ما في جلسة فعّالة بالذاكرة، بس لازم نمسح المخزّن حتى الربط الجاي ينضف.
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

/** إرسال رسالة نصية للعميل */
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

/** إرسال صورة منتج مع تعليق */
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

/** استرجاع كل الجلسات المحفوظة عند إقلاع السيرفر */
export async function resumeAllSessions() {
  const channels = await listResumableChannels();
  if (!channels.length) {
    log('manager', 'ما في جلسات واتساب محفوظة للاسترجاع');
    return;
  }
  log('manager', `استرجاع ${channels.length} جلسة واتساب محفوظة…`);
  for (const { channelId, merchantId } of channels) {
    try {
      // منشغّل بس الجلسات يلي عندها بيانات ربط محفوظة فعلًا (registered)،
      // حتى ما نفتح سوكيتات فاضية لقنوات ما خلّصت ربط.
      const auth = await useSupabaseAuthState(channelId);
      if (!auth.state.creds?.registered) {
        log('manager', `تجاهل ${channelId} — ما في جلسة مكتملة محفوظة`);
        continue;
      }
      await startSession(channelId, { merchantId });
    } catch (e) {
      logError('manager', `فشل استرجاع الجلسة ${channelId}`, e);
    }
    await new Promise((r) => setTimeout(r, 1200)); // نوزّع الاتصالات بدل دفعة وحدة
  }
}

/** فحص دوري: إذا جلسة مربوطة صارت مقطوعة وما في مؤقت إعادة اتصال، نصلّحها. */
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
