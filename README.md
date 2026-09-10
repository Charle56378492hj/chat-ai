# ردّآلي — منصة واتساب وتلغرام

منصة عربية لإدارة محادثات العملاء والطلبات والمبيعات عبر **واتساب وتلغرام فقط**، مع صندوق وارد موحّد، مساعد ذكاء اصطناعي، إدارة منتجات وطلبات، وأتمتة.

## التقنيات

- React 18 + TypeScript + Vite
- Tailwind CSS
- Supabase: قاعدة بيانات، مصادقة، RLS، وEdge Functions
- بوابة WhatsApp عبر Baileys
- بوابة Telegram عبر MTProto

## التشغيل المحلي

```bash
npm ci
cp .env.example .env
npm run dev
```

## متغيرات الواجهة

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WHATSAPP_GATEWAY_URL`
- `VITE_TELEGRAM_GATEWAY_URL`

## الخدمات الخلفية

راجع `whatsapp-server/env.example` و`telegram-server/env.example`. لا تضع أي مفاتيح أو ملفات `.env` داخل Git.

## الاختبارات والبناء

```bash
npm run typecheck
npm run lint
npm run build
```

القنوات المدعومة في هذه النسخة هي واتساب وتلغرام فقط.
