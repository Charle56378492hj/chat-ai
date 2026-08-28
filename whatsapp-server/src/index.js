// ─────────────────────────────────────────────────────────────────────────────
// بوابة واتساب — واجهة HTTP بسيطة تستخدمها لوحة التحكم.
//
//  POST /api/sessions/:channelId/start     → بدء/استئناف الجلسة (وتوليد QR)
//  GET  /api/sessions/:channelId/status    → الحالة الحالية + صورة QR
//  POST /api/sessions/:channelId/logout    → فصل الحساب ومسح الجلسة
//  POST /api/sessions/:channelId/send      → إرسال رسالة (من صندوق الوارد)
//  GET  /health                            → فحص صحة للاستضافة
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cors from 'cors';

import { env } from './env.js';
import { log, logError } from './logger.js';
import { authorizeChannel } from './auth.js';
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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'whatsapp-gateway', sessions: listSessions(), uptime: process.uptime() });
});

// كل مسارات الجلسة بتمرّ بنفس التحقق من الصلاحية.
async function withChannel(req, res, handler) {
  const channelId = req.params.channelId;
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) {
    return res.status(400).json({ error: 'معرّف قناة غير صالح' });
  }
  const auth = await authorizeChannel(req, channelId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    return await handler(channelId, auth);
  } catch (e) {
    logError('api', `فشل تنفيذ الطلب على ${channelId}`, e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'خطأ غير متوقع' });
  }
}

app.post('/api/sessions/:channelId/start', (req, res) =>
  withChannel(req, res, async (channelId, auth) => {
    const forceNewQr = Boolean(req.body?.force_new_qr);
    const snapshot = await startSession(channelId, {
      merchantId: auth.channel.merchant_id,
      forceNewQr,
    });
    res.json(snapshot);
  })
);

app.get('/api/sessions/:channelId/status', (req, res) =>
  withChannel(req, res, async (channelId) => {
    res.json(getSessionSnapshot(channelId));
  })
);

app.post('/api/sessions/:channelId/logout', (req, res) =>
  withChannel(req, res, async (channelId) => {
    await logoutSession(channelId);
    res.json({ ok: true, status: 'logged_out' });
  })
);

app.post('/api/sessions/:channelId/send', (req, res) =>
  withChannel(req, res, async (channelId) => {
    const { to, text } = req.body ?? {};
    if (!to || !text) return res.status(400).json({ error: 'المطلوب: to و text' });
    const id = await sendText(channelId, String(to), String(text));
    res.json({ ok: true, message_id: id });
  })
);

// مسار داخلي للـ scheduler فقط، ولا يقبل JWT من المتصفح.
app.post('/api/internal/sessions/:channelId/send', async (req, res) => {
  if (req.headers['x-gateway-secret'] !== env.gatewaySecret) return res.status(401).json({ error: 'غير مصرح' });
  const channelId = req.params.channelId;
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) return res.status(400).json({ error: 'معرّف قناة غير صالح' });
  try {
    const { to, text } = req.body ?? {};
    if (!to || !text) return res.status(400).json({ error: 'المطلوب: to و text' });
    const id = await sendText(channelId, String(to), String(text));
    res.json({ ok: true, message_id: id });
  } catch (e) {
    logError('internal-api', `فشل إرسال مجدول على ${channelId}`, e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'خطأ غير متوقع' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

const server = app.listen(env.port, '0.0.0.0', async () => {
  log('server', `بوابة واتساب تعمل على المنفذ ${env.port}`);
  try {
    await resumeAllSessions();
  } catch (e) {
    logError('server', 'فشل استرجاع الجلسات', e);
  }
  startWatchdog();
});

// أخطاء غير متوقعة ما لازم تطفّي السيرفر وتفصل كل الزبائن.
process.on('unhandledRejection', (reason) => logError('process', 'وعد مرفوض بدون معالجة', reason));
process.on('uncaughtException', (error) => logError('process', 'استثناء غير معالَج', error));

function shutdown(signal) {
  log('server', `إيقاف البوابة (${signal})`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
