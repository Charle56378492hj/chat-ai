import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { log, logError } from './logger.js';
import { authorizeTelegramChannel } from './auth.js';
import { getSessionSnapshot, listSessions, logoutSession, publishText, sendText, startSession, resumeAllSessions, submitPassword } from './manager.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: env.allowedOrigins.includes('*') ? true : env.allowedOrigins,
  credentials: false,
}));

app.get('/health', (_req, res) => res.json({
  ok: true, service: 'telegram-mtproto-gateway', sessions: listSessions(), uptime: process.uptime(),
}));

async function withChannel(req, res, handler) {
  const channelId = req.params.channelId;
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) return res.status(400).json({ error: 'معرّف قناة غير صالح' });
  const auth = await authorizeTelegramChannel(req, channelId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    return await handler(channelId, auth);
  } catch (error) {
    logError('api', `فشل تنفيذ الطلب على ${channelId}`, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' });
  }
}

app.post('/api/telegram/sessions/:channelId/start', (req, res) => withChannel(req, res, async (channelId, auth) => {
  const snapshot = await startSession(channelId, auth.channel, Boolean(req.body?.force_new_qr));
  res.json(snapshot);
}));

app.get('/api/telegram/sessions/:channelId/status', (req, res) => withChannel(req, res, async (channelId, auth) => {
  res.json(await getSessionSnapshot(channelId, auth.channel));
}));

app.post('/api/telegram/sessions/:channelId/logout', (req, res) => withChannel(req, res, async (channelId) => {
  await logoutSession(channelId);
  res.json({ ok: true, status: 'logged_out' });
}));

app.post('/api/telegram/sessions/:channelId/password', (req, res) => withChannel(req, res, async (channelId) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password.trim()) return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
  await submitPassword(channelId, password);
  res.json({ ok: true });
}));

async function sendRoute(req, res, publish = false) {
  return withChannel(req, res, async (channelId) => {
    const { to, text } = req.body || {};
    if (!to || !text || String(text).length > 4096) {
      return res.status(400).json({ error: 'المطلوب: to و text (حتى 4096 حرفًا)' });
    }
    const messageId = publish
      ? await publishText(channelId, String(to), String(text))
      : await sendText(channelId, String(to), String(text));
    res.json({ ok: true, message_id: messageId });
  });
}

app.post('/api/telegram/sessions/:channelId/send', (req, res) => sendRoute(req, res, false));
app.post('/api/telegram/sessions/:channelId/publish', (req, res) => sendRoute(req, res, true));
app.use((_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

const server = app.listen(env.port, '0.0.0.0', async () => {
  log('server', `بوابة تيليغرام MTProto تعمل على المنفذ ${env.port}`);
  try { await resumeAllSessions(); } catch (error) { logError('server', 'فشل استرجاع الجلسات', error); }
});

process.on('unhandledRejection', (reason) => logError('process', 'وعد مرفوض بدون معالجة', reason));
process.on('uncaughtException', (error) => logError('process', 'استثناء غير معالَج', error));
function shutdown(signal) {
  log('server', `إيقاف البوابة (${signal})`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));