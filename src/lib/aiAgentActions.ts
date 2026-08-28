import { sendGmailMessage } from './gmailGateway';
import { sendTelegramText } from './telegramGateway';
import { sendWhatsAppText } from './whatsappGateway';

export type AgentChannel = { id: string; type: string; name?: string; is_active?: boolean };

export type AgentSendInput = {
  channel: AgentChannel;
  recipient: string;
  text: string;
  subject?: string;
};

export async function sendAgentMessage(input: AgentSendInput) {
  const { channel, recipient, text, subject = 'رسالة من متجرك' } = input;
  if (channel.is_active === false) throw new Error('القناة المحددة غير نشطة حاليًا.');
  switch (channel.type) {
    case 'whatsapp':
      return sendWhatsAppText(channel.id, recipient, text);
    case 'telegram':
      return sendTelegramText(channel.id, recipient, text);
    case 'email':
      return sendGmailMessage({ to: recipient, subject, body: text });
    default:
      throw new Error(`الإرسال المباشر غير مفعّل بعد للقناة ${channel.type}. يجب استخدام موصلها المعتمد من الخادم.`);
  }
}
