// ─────────────────────────────────────────────────────────────────────────────
// بوابة واتساب — خادم HTTP محسّن
//
// المسارات:
//  POST /api/sessions/:channelId/start     → بدء/استئناف الجلسة وتوليد QR
//  GET  /api/sessions/:channelId/status    → الحالة الحالية + صورة QR
//  POST /api/sessions/:channelId/logout    → فصل الحساب
//  POST /api/sessions/:channelId/send      → إرسال رسالة
//  GET  /health                            → فحص صحة الخادم
//  GET  /api/debug/sessions                → معلومات تشخيصية (للتطوير)
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cors from 'cors';

import { env } from './env.js';
import { log, logError } from './logger.js';
import { authorizeChannel } from './auth.js';
import { checkConnection } from './store.js';
import {
  startSession,
  logoutSession,
  sendText,
  getSessionSnapshot,
  resumeAllSessions,
  startWatchdog,
  listSessions,
} from './manager.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: env.allowedOrigins.includes('*') ? true : env.allowedOrigins,
    credentials: false,
  })
);

// ─── فحص صحة الخادم ───────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const dbCheck = await checkConnection();
    const isHealthy = dbCheck.ok;
    
    res.status(isHealthy ? 200 : 503).json({
      ok: isHealthy,
      service: 'whatsapp-gateway',
      uptime: process.uptime(),
      sessions: listSessions().length,
      database: dbCheck.ok ? 'متصل ✅' : `خطأ: ${dbCheck.error}`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logError('health', 'فشل فحص الصحة', e);
    res.status(503).json({
      ok: false,
      error: 'فشل فحص الصحة',
    });
  }
});

// ─── معلومات تشخيصية (للتطوير فقط) ───────────────────────────────────────
app.get('/api/debug/sessions', (_req, res) => {
  // تحقق من رمز سري إذا كان مضبوطًا
  if (env.gatewaySecret && _req.headers['x-gateway-secret'] !== env.gatewaySecret) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  
  const sessions = listSessions();
  res.json({
    total: sessions.length,
    sessions: sessions.map(s => ({
      channelId: s.channel_id,
      status: s.status,
      phone: s.phone,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── التحقق من الصلاحية لجميع مسارات الجلسة ───────────────────────────────
async function withChannel(req, res, handler) {
  const channelId = req.params.channelId;
  
  // تحقق من صيغة المعرف
  if (!/^[0-9a-f\-]{36}$/i.test(channelId)) {
    return res.status(400).json({ 
      error: 'معرّف قناة غير صالح',
      expected: 'UUID format (36 characters)'
    });
  }
  
  // تحقق من الصلاحية
  const auth = await authorizeChannel(req, channelId);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }
  
  try {
    return await handler(channelId, auth);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'خطأ غير متوقع';
    logError('api', `فشل تنفيذ الطلب على ${channelId}`, e);
    return res.status(500).json({ 
      error: errorMsg,
      channel_id: channelId
    });
  }
}

// ─── بدء الجلسة / توليد QR ───────────────────────────────────────────────
app.post('/api/sessions/:channelId/start', (req, res) =>
  withChannel(req, res, async (channelId, auth) => {
    const forceNewQr = Boolean(req.body?.force_new_qr);
    
    log('api', `طلب بدء جلسة ${channelId}${forceNewQr ? ' (QR جديد)' : ''}`);
    
    const snapshot = await startSession(channelId, {
      merchantId: auth.channel.merchant_id,
      forceNewQr,
    });
    
    res.json(snapshot);
  })
);

// ─── استطلاع الحالة ───────────────────────────────────────────────────────
app.get('/api/sessions/:channelId/status', (req, res) =>
  withChannel(req, res, async (channelId) => {
    const snapshot = getSessionSnapshot(channelId);
    res.json(snapshot);
  })
);

// ─── فصل الحساب ───────────────────────────────────────────────────────────
app.post('/api/sessions/:channelId/logout', (req, res) =>
  withChannel(req, res, async (channelId) => {
    log('api', `طلب فصل القناة ${channelId}`);
    
    await logoutSession(channelId);
    res.json({ 
      ok: true, 
      status: 'logged_out',
      message: 'تم فصل الحساب بنجاح'
    });
  })
);

// ─── إرسال رسالة من لوحة التحكم ───────────────────────────────────────────
app.post('/api/sessions/:channelId/send', (req, res) =>
  withChannel(req, res, async (channelId) => {
    const { to, text } = req.body ?? {};
    
    if (!to || !text) {
      return res.status(400).json({ 
        error: 'المطلوب: to (الرقم) و text (الرسالة)'
      });
    }
    
    if (typeof to !== 'string' || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'to و text يجب أن يكونا نصوص'
      });
    }
    
    if (text.length > 4096) {
      return res.status(400).json({ 
        error: 'الرسالة طويلة جدًا (أقصى 4096 حرف)'
      });
    }
    
    try {
      const messageId = await sendText(channelId, to, text);
      res.json({ 
        ok: true, 
        message_id: messageId,
        to,
        text_length: text.length
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'فشل إرسال الرسالة';
      res.status(400).json({ error: errorMsg });
    }
  })
);

// ─── مسار داخلي للـ scheduler (لا يحتاج JWT من المتصفح) ───────────────────
app.post('/api/internal/sessions/:channelId/send', async (req, res) => {
  // تحقق من رمز البوابة السري
  if (req.headers['x-gateway-secret'] !== env.gatewaySecret) {
    return res.status(401).json({ error: 'غير مصرح (رمز البوابة غير صحيح)' });
  }
  
  const channelId = req.params.channelId;
  
  // تحقق من صيغة المعرف
  if (!/^[0-9a-f\-]{36}$/i.test(channelId)) {
    return res.status(400).json({ error: 'معرّف قناة غير صالح' });
  }
  
  const { to, text } = req.body ?? {};
  
  if (!to || !text) {
    return res.status(400).json({ 
      error: 'المطلوب: to و text'
    });
  }
  
  try {
    const messageId = await sendText(channelId, String(to), String(text));
    res.json({ 
      ok: true, 
      message_id: messageId,
      internal: true
    });
  } catch (e) {
    logError('internal-api', `فشل إرسال مجدول على ${channelId}`, e);
    res.status(400).json({ 
      error: e instanceof Error ? e.message : 'خطأ غير متوقع'
    });
  }
});

// ─── رسالة خطأ 404 ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ 
    error: 'المسار غير موجود',
    path: _req.path,
    method: _req.method,
    availablePaths: [
      'POST /api/sessions/:channelId/start',
      'GET /api/sessions/:channelId/status',
      'POST /api/sessions/:channelId/logout',
      'POST /api/sessions/:channelId/send',
      'GET /health',
      'GET /api/debug/sessions (requires X-Gateway-Secret)'
    ]
  });
});

// ─── بدء السيرفر ──────────────────────────────────────────────────────────
const server = app.listen(env.port, '0.0.0.0', async () => {
  log('server', `✅ بوابة واتساب تعمل على المنفذ ${env.port}`);
  log('server', `🔐 الأصول المسموح بها: ${env.allowedOrigins.join(', ')}`);
  
  try {
    log('server', '⏳ جارٍ استرجاع الجلسات المحفوظة…');
    await resumeAllSessions();
    log('server', '✅ تم استرجاع الجلسات المحفوظة');
  } catch (e) {
    logError('server', 'فشل استرجاع الجلسات', e);
  }
  
  startWatchdog();
  log('server', '🐕 مراقب الجلسات قيد التشغيل');
});

// ─── معالجة الأخطاء غير المتوقعة ──────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logError('process', 'وعد مرفوض بدون معالجة', reason);
});

process.on('uncaughtException', (error) => {
  logError('process', 'استثناء غير معالَج', error);
  // في الإنتاج، قد تريد إعادة تشغيل الخادم هنا
});

// ─── الإيقاف الآمن ────────────────────────────────────────────────────────
function shutdown(signal) {
  log('server', `🛑 إيقاف البوابة (${signal})`);
  server.close(() => {
    log('server', '✅ تم إيقاف البوابة بنجاح');
    process.exit(0);
  });
  
  // أجبر الإيقاف بعد 8 ثوان إذا لم يحدث
  setTimeout(() => {
    logError('server', 'فُرض إيقاف البوابة (لم تنهِ الاتصالات في الوقت المحدد)');
    process.exit(1);
  }, 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
