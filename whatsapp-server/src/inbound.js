// ─────────────────────────────────────────────────────────────────────────────
// معالجة الرسائل الواردة من واتساب.
//
// البوابة ما بتحتوي منطق الذكاء الاصطناعي — منمرّر الرسالة لدالة
// whatsapp-inbound على Supabase (نفس منطق تيليغرام: تسجيل العميل/المحادثة،
// جلب المنتجات وإعدادات الذكاء، ثم توليد الرد)، والدالة بترجعلنا النص
// والصور المطلوب إرسالها ونحن منبعتها عبر واتساب.
// هيك منطق الرد يبقى بمكان واحد لكل القنوات.
// ─────────────────────────────────────────────────────────────────────────────
import { env } from './env.js';
import { log, logError } from './logger.js';

const INBOUND_URL = `${env.supabaseUrl}/functions/v1/whatsapp-inbound`;

// نمنع معالجة نفس الرسالة مرتين (واتساب أحيانًا يعيد إرسال نفس الحدث).
const processed = new Map();
function alreadyProcessed(id) {
  const now = Date.now();
  for (const [key, time] of processed) if (now - time > 10 * 60_000) processed.delete(key);
  if (processed.has(id)) return true;
  processed.set(id, now);
  return false;
}

function extractText(message) {
  const m = message?.message;
  if (!m) return '';
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.templateButtonReplyMessage?.selectedDisplayText ??
    ''
  ).trim();
}

export async function handleIncomingMessage(session, message) {
  // نتجاهل: رسائلنا نحن، حالات (status@broadcast)، والقروبات
  if (!message?.key || message.key.fromMe) return;
  const remoteJid = message.key.remoteJid ?? '';
  if (!remoteJid || remoteJid === 'status@broadcast') return;
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@newsletter')) return;
  if (!message.message) return; // إيصالات/تحديثات بدون محتوى

  const messageId = message.key.id;
  if (messageId && alreadyProcessed(`${session.channelId}:${messageId}`)) return;

  const text = extractText(message);
  const phone = remoteJid.split('@')[0];
  const pushName = message.pushName || `عميل واتساب ${phone}`;

  log('inbound', `رسالة من ${phone} للقناة ${session.channelId}`);

  // إشعار "تم القراءة" + مؤشر الكتابة يخلّي التجربة طبيعية تمامًا للعميل
  try {
    await session.sock?.readMessages([message.key]);
  } catch {
    /* غير مهم */
  }

  let payload;
  try {
    const res = await fetch(INBOUND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': env.gatewaySecret,
      },
      body: JSON.stringify({
        channel_id: session.channelId,
        from: phone,
        jid: remoteJid,
        name: pushName,
        text,
        has_media: !text,
        message_id: messageId,
      }),
    });
    const raw = await res.text();
    try {
      payload = JSON.parse(raw);
    } catch {
      logError('inbound', 'رد غير متوقع من دالة المعالجة', raw.slice(0, 300));
      return;
    }
    if (!res.ok) {
      logError('inbound', `دالة المعالجة رجّعت ${res.status}`, payload?.error ?? raw.slice(0, 300));
      return;
    }
  } catch (e) {
    logError('inbound', 'تعذّر الاتصال بدالة المعالجة', e);
    return;
  }

  const replyText = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
  const images = Array.isArray(payload?.images) ? payload.images : [];

  if (!replyText && !images.length) return;

  const { sendText, sendImage } = await import('./manager.js');

  if (replyText) {
    try {
      await session.sock?.sendPresenceUpdate('composing', remoteJid);
      // تأخير بسيط متناسب مع طول الرد حتى يبان الرد طبيعي مو آلي
      await new Promise((r) => setTimeout(r, Math.min(400 + replyText.length * 12, 2500)));
      await sendText(session.channelId, remoteJid, replyText);
    } catch (e) {
      logError('inbound', 'فشل إرسال الرد النصي', e);
    }
  }

  for (const image of images.slice(0, 5)) {
    if (!image?.url) continue;
    try {
      await sendImage(session.channelId, remoteJid, image.url, image.caption ?? '');
    } catch (e) {
      logError('inbound', `فشل إرسال صورة ${image.url}`, e);
    }
  }
}
