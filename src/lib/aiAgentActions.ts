import { sendTelegramText } from './telegramGateway';
import { sendWhatsAppText } from './whatsappGateway';

export type AgentChannel = { id: string; type: string; name?: string; is_active?: boolean };
export type AgentSendInput = { channel: AgentChannel; recipient: string; text: string };

export async function sendAgentMessage(input: AgentSendInput) {
  const { channel, recipient, text } = input;
  if (channel.is_active === false) throw new Error('القناة المحددة غير نشطة حاليًا.');
  if (channel.type === 'whatsapp') return sendWhatsAppText(channel.id, recipient, text);
  if (channel.type === 'telegram') return sendTelegramText(channel.id, recipient, text);
  throw new Error('الإرسال المباشر متاح فقط عبر واتساب وتلغرام.');
}
