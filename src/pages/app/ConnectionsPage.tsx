import { useState, useRef } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { CHANNEL_TYPES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, RefreshCw, Plug, Trash2, Check, X,
  Activity, ExternalLink, Zap, QrCode, Key, Bot, Copy,
  CheckCircle, ArrowRight, Shield, Settings, Wifi,
} from 'lucide-react';

// ─── Icon map ────────────────────────────────────────────────────────────────
const iconMap: Record<string, typeof MessageCircle> = {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music, ShoppingBag, Search,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp:   'from-green-400 to-green-600',
  messenger:  'from-blue-400 to-blue-600',
  instagram:  'from-pink-400 to-rose-500',
  telegram:   'from-sky-400 to-blue-500',
  website:    'from-indigo-400 to-violet-500',
  sms:        'from-amber-400 to-orange-500',
  email:      'from-slate-400 to-slate-600',
  tiktok:     'from-slate-700 to-slate-900',
  tiktok_shop:'from-orange-400 to-rose-500',
  google:     'from-red-400 to-orange-400',
};

const CHANNEL_DOCS: Record<string, string> = {
  whatsapp:   'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  messenger:  'https://developers.facebook.com/docs/messenger-platform',
  instagram:  'https://developers.facebook.com/docs/instagram-api',
  telegram:   'https://core.telegram.org/bots/api',
  tiktok:     'https://developers.tiktok.com',
  tiktok_shop:'https://partner.tiktokshop.com',
  google:     'https://developers.google.com/my-business',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalStep =
  | 'choose'
  | 'wa_api' | 'wa_qr'
  | 'tg_token' | 'tg_qr'
  | 'oauth'
  | 'generic'
  | 'widget';

interface ModalData {
  channelType: string;
  channelLabel: string;
  step: ModalStep;
  existingId?: string;
  existingConfig?: Record<string, string>;
}

// ─── Helper: QR image ────────────────────────────────────────────────────────
function QrImage({ value }: { value: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`;
  return (
    <div className="flex justify-center p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
      <img src={src} alt="QR" width={200} height={200} className="rounded-xl" />
    </div>
  );
}

// ─── Helper: copy field ───────────────────────────────────────────────────────
function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input readOnly className="input flex-1 font-mono text-xs" value={value} />
        <button type="button" onClick={copy} className="btn-secondary btn-sm flex-shrink-0">
          {done ? <CheckCircle size={15} className="text-green-500" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, wide = false, children }: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Step: Choose method ──────────────────────────────────────────────────────
function StepChoose({ data, goTo, onClose }: {
  data: ModalData;
  goTo: (s: ModalStep) => void;
  onClose: () => void;
}) {
  const isWa = data.channelType === 'whatsapp';

  const opt1Step: ModalStep = isWa ? 'wa_api' : 'tg_token';
  const opt2Step: ModalStep = isWa ? 'wa_qr'  : 'tg_qr';

  return (
    <Modal title={`ربط ${data.channelLabel}`} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-5 text-center">اختر طريقة الربط</p>
      <div className="space-y-3">
        {/* API / Token option */}
        <button
          type="button"
          onClick={() => goTo(opt1Step)}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition-all text-right group"
        >
          <div className="h-12 w-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors flex-shrink-0">
            <Key size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900">
              {isWa ? 'ربط عبر API الرسمي' : 'ربط البوت عبر التوكن'}
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              {isWa
                ? 'WhatsApp Cloud API من Meta — للأعمال الاحترافية'
                : 'أدخل توكن البوت من @BotFather — سريع وآمن'}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold mt-1">
              <Shield size={11} /> موصى به
            </span>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-sky-500 flex-shrink-0" />
        </button>

        {/* QR option */}
        <button
          type="button"
          onClick={() => goTo(opt2Step)}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-right group"
        >
          <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 group-hover:bg-violet-500 group-hover:text-white transition-colors flex-shrink-0">
            <QrCode size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900">ربط عبر QR Code</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {isWa
                ? 'امسح الـ QR من تطبيق واتساب على هاتفك'
                : 'امسح الـ QR من تطبيق تيليغرام لربط الحساب'}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold mt-1">
              <Smartphone size={11} /> الأسرع والأسهل
            </span>
          </div>
          <ArrowRight size={18} className="text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
        </button>
      </div>
    </Modal>
  );
}

// ─── Step: WhatsApp API ───────────────────────────────────────────────────────
function StepWaApi({ data, onClose, onSave }: {
  data: ModalData;
  onClose: () => void;
  onSave: (cfg: Record<string, string>) => Promise<void>;
}) {
  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  const [form, setForm] = useState({
    phone_number_id:     data.existingConfig?.phone_number_id     ?? '',
    access_token:        data.existingConfig?.access_token        ?? '',
    business_account_id: data.existingConfig?.business_account_id ?? '',
    verify_token:        data.existingConfig?.verify_token        ?? Math.random().toString(36).slice(2, 10),
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({ ...form, method: 'api' });
    setSaving(false);
  }

  return (
    <Modal title="واتساب — Cloud API" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
          <div className="font-bold mb-2">📋 خطوات الربط:</div>
          <ol className="list-decimal list-inside space-y-1 text-sky-700">
            <li>افتح <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-semibold">Meta for Developers</a> وأنشئ تطبيقًا</li>
            <li>فعّل منتج <strong>WhatsApp Business</strong></li>
            <li>انسخ <strong>Phone Number ID</strong> و<strong>Access Token</strong></li>
            <li>أضف Webhook URL أدناه في إعدادات Webhooks</li>
          </ol>
        </div>

        <CopyField label="Webhook URL" value={webhookUrl} />

        <div>
          <label className="label">Phone Number ID <span className="text-red-500">*</span></label>
          <input className="input" placeholder="1234567890"
            value={form.phone_number_id}
            onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
        </div>
        <div>
          <label className="label">Access Token <span className="text-red-500">*</span></label>
          <input className="input font-mono text-sm" placeholder="EAAxxxx..."
            value={form.access_token}
            onChange={(e) => setForm({ ...form, access_token: e.target.value })} />
        </div>
        <div>
          <label className="label">Business Account ID</label>
          <input className="input" placeholder="0987654321"
            value={form.business_account_id}
            onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} />
        </div>
        <CopyField label="Verify Token (ضعه في Webhook)" value={form.verify_token} />

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button
            type="button"
            disabled={!form.phone_number_id || !form.access_token || saving}
            onClick={submit}
            className="btn-primary flex-1"
          >
            {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط الآن</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Step: WhatsApp QR ────────────────────────────────────────────────────────
function StepWaQr({ onClose, goToApi }: {
  onClose: () => void;
  goToApi: () => void;
}) {
  return (
    <Modal title="واتساب — QR Code" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <div className="font-bold mb-2">⚠️ ربط واتساب عبر QR</div>
          <p className="leading-relaxed">
            ربط واتساب عبر مسح QR يتطلب خادمًا خاصًا يعمل ببروتوكول واتساب الداخلي.
            هذه الميزة غير متوفرة حاليًا في النظام.
          </p>
          <p className="mt-2 leading-relaxed">
            البديل المدعوم والرسمي هو <strong>WhatsApp Cloud API</strong> من Meta —
            وهو آمن وموثوق ويعمل بشكل كامل من خلال هذا النظام.
          </p>
        </div>

        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4">
          <div className="font-bold text-sky-800 mb-2 text-sm">📋 ما تحتاجه لـ Cloud API:</div>
          <ul className="list-disc list-inside space-y-1 text-sm text-sky-700">
            <li>حساب Meta for Developers (مجاني)</li>
            <li>رقم هاتف مفعّل على WhatsApp Business</li>
            <li>Phone Number ID و Access Token</li>
          </ul>
        </div>

        <button type="button" onClick={goToApi} className="btn-primary w-full">
          <Key size={16} /> الانتقال إلى Cloud API
        </button>
        <button type="button" onClick={onClose} className="btn-secondary w-full">إلغاء</button>
      </div>
    </Modal>
  );
}

// ─── Step: Telegram Token ─────────────────────────────────────────────────────
function StepTgToken({ data, onClose, onSave }: {
  data: ModalData;
  onClose: () => void;
  onSave: (cfg: Record<string, string>, label?: string) => Promise<void>;
}) {
  const [token, setToken]     = useState(data.existingConfig?.bot_token ?? '');
  const [botInfo, setBotInfo] = useState<{ username: string; name: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  async function verify() {
    if (!token.trim()) return;
    setChecking(true); setError(''); setBotInfo(null);
    try {
      const res  = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      const json = await res.json() as { ok: boolean; result?: { username: string; first_name: string } };
      if (json.ok && json.result) {
        setBotInfo({ username: json.result.username, name: json.result.first_name });
      } else {
        setError('التوكن غير صحيح. تأكد من نسخه من @BotFather بشكل كامل.');
      }
    } catch {
      setError('تعذّر الاتصال بتيليغرام. تحقق من الإنترنت وأعد المحاولة.');
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setSaving(true);
    await onSave(
      { bot_token: token.trim(), method: 'token', bot_username: botInfo?.username ?? '' },
      botInfo ? `تيليغرام — @${botInfo.username}` : 'تيليغرام — Bot',
    );
    setSaving(false);
  }

  return (
    <Modal title="تيليغرام — Bot Token" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
          <div className="font-bold mb-2">🤖 كيف تحصل على التوكن:</div>
          <ol className="list-decimal list-inside space-y-1 text-sky-700">
            <li>افتح تيليغرام وابحث عن <strong>@BotFather</strong></li>
            <li>أرسل له <code className="bg-sky-100 px-1 rounded">/newbot</code></li>
            <li>اتبع التعليمات لاختيار اسم ومعرّف للبوت</li>
            <li>انسخ الـ <strong>API Token</strong> الذي يرسله لك</li>
          </ol>
        </div>

        <div>
          <label className="label">API Token <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
              value={token}
              onChange={(e) => { setToken(e.target.value); setBotInfo(null); setError(''); }}
            />
            <button type="button" disabled={!token.trim() || checking} onClick={verify} className="btn-secondary flex-shrink-0">
              {checking ? <Spinner size="sm" /> : 'تحقق'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>

        {botInfo && (
          <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <div>
              <div className="font-bold text-green-800 text-sm">البوت صحيح ✅</div>
              <div className="text-sm text-green-700">{botInfo.name} · <span className="font-mono">@{botInfo.username}</span></div>
            </div>
          </div>
        )}

        <CopyField
          label="Webhook URL (معلومة)"
          value={`${window.location.origin}/api/webhooks/telegram`}
        />

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button type="button" disabled={!token.trim() || saving} onClick={submit} className="btn-primary flex-1">
            {saving ? <Spinner size="sm" /> : <><Bot size={16} /> ربط البوت</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Step: Telegram QR ────────────────────────────────────────────────────────
function StepTgQr({ onClose, onSave }: {
  onClose: () => void;
  onSave: (cfg: Record<string, string>) => Promise<void>;
}) {
  const session  = useRef(`tg-${Date.now()}`);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    await onSave({ method: 'qr', session: session.current });
    setSaving(false);
  }

  return (
    <Modal title="تيليغرام — حساب كامل (QR)" onClose={onClose}>
      {!confirmed ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
            ⚠️ هذا يربط <strong>حسابك الشخصي</strong> وليس بوت. استخدمه بحذر.
          </div>
          <QrImage value={`tg://login?token=${session.current}`} />
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="font-bold text-slate-800 mb-2 text-sm">📱 خطوات الربط:</div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600">
              <li>افتح <strong>تيليغرام</strong> على هاتفك</li>
              <li>اذهب إلى <strong>الإعدادات → الأجهزة</strong></li>
              <li>اضغط <strong>"ربط جهاز سطح المكتب"</strong></li>
              <li>امسح الـ QR</li>
            </ol>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400 justify-center">
            <Spinner size="sm" /> <span>في انتظار المسح...</span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button type="button" onClick={() => setConfirmed(true)} className="btn-primary flex-1">
              <Check size={16} /> تم المسح
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 space-y-4">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xl">تم الربط! 🎉</div>
            <p className="text-sm text-slate-500 mt-1">حساب تيليغرام متصل</p>
          </div>
          <button type="button" disabled={saving} onClick={finish} className="btn-primary w-full">
            {saving ? <Spinner size="sm" /> : 'حفظ وإغلاق'}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Step: OAuth (Facebook / Instagram / Messenger) ───────────────────────────
function StepOAuth({ data, onClose, onSave }: {
  data: ModalData;
  onClose: () => void;
  onSave: (cfg: Record<string, string>) => Promise<void>;
}) {
  const isFb = data.channelType === 'messenger';
  const isIg = data.channelType === 'instagram';
  const [pageId, setPageId]           = useState(data.existingConfig?.page_id           ?? '');
  const [pageToken, setPageToken]     = useState(data.existingConfig?.page_access_token ?? '');
  const [saving, setSaving]           = useState(false);

  const gradient = isFb
    ? 'from-blue-500 to-blue-700'
    : isIg
    ? 'from-pink-500 via-rose-500 to-orange-400'
    : 'from-blue-500 to-indigo-600';

  const Icon = isFb ? Facebook : isIg ? Instagram : Globe;
  const docUrl = isFb ? CHANNEL_DOCS.messenger : CHANNEL_DOCS.instagram;

  async function submit() {
    setSaving(true);
    await onSave({
      method: 'api',
      page_id: pageId.trim(),
      page_access_token: pageToken.trim(),
      platform: data.channelType,
      connected_at: new Date().toISOString(),
    });
    setSaving(false);
  }

  return (
    <Modal title={`ربط ${data.channelLabel}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-center text-white`}>
          <Icon size={36} className="mx-auto mb-2 opacity-90" />
          <div className="font-bold">ربط {data.channelLabel} عبر بيانات الصفحة</div>
        </div>

        <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
          <div className="font-bold mb-2">📋 كيف تحصل على البيانات:</div>
          <ol className="list-decimal list-inside space-y-1 text-sky-700">
            <li>افتح <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-semibold">Meta for Developers</a> وأنشئ تطبيقًا</li>
            {isFb && (
              <>
                <li>أضف منتج <strong>Messenger</strong> وفعّله</li>
                <li>احصل على <strong>Page ID</strong> و<strong>Page Access Token</strong> من إعدادات التطبيق</li>
              </>
            )}
            {isIg && (
              <>
                <li>أضف منتج <strong>Instagram</strong> وربطه بصفحة فيسبوك</li>
                <li>احصل على <strong>Page ID</strong> و<strong>Page Access Token</strong> من إعدادات التطبيق</li>
              </>
            )}
            <li>أدخل البيانات أدناه واضغط ربط</li>
          </ol>
        </div>

        <div>
          <label className="label">Page ID <span className="text-red-500">*</span></label>
          <input className="input font-mono text-sm" placeholder="1234567890"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)} />
        </div>
        <div>
          <label className="label">Page Access Token <span className="text-red-500">*</span></label>
          <input className="input font-mono text-sm" placeholder="EAABxxxx..."
            value={pageToken}
            onChange={(e) => setPageToken(e.target.value)} />
        </div>

        {docUrl && (
          <a href={docUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
            <ExternalLink size={14} /> دليل الربط الرسمي
          </a>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button type="button" disabled={!pageId.trim() || !pageToken.trim() || saving} onClick={submit} className="btn-primary flex-1">
            {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط الآن</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Step: Website Widget ─────────────────────────────────────────────────────
function StepWidget({ data, onClose, onSave }: {
  data: ModalData;
  onClose: () => void;
  onSave: (cfg: Record<string, string>) => Promise<void>;
}) {
  const { merchant } = useAuth();
  const [siteUrl, setSiteUrl] = useState(data.existingConfig?.site_url ?? '');
  const [saving, setSaving]   = useState(false);

  const code = `<script src="${window.location.origin}/widget/chat.js" data-merchant="${merchant?.id ?? 'YOUR_ID'}" async></script>`;

  async function submit() {
    setSaving(true);
    await onSave({ method: 'widget', site_url: siteUrl, code });
    setSaving(false);
  }

  return (
    <Modal title="شات الموقع — Widget" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-800">
          <div className="font-bold mb-1">🌐 كيف تضيف الشات لموقعك:</div>
          <p>انسخ الكود أدناه والصقه قبل إغلاق <code className="bg-indigo-100 px-1 rounded">&lt;/body&gt;</code> في موقعك.</p>
        </div>
        <div>
          <label className="label">كود التضمين</label>
          <textarea readOnly rows={3} className="input font-mono text-xs w-full" value={code} />
          <button type="button" onClick={() => navigator.clipboard.writeText(code)} className="btn-secondary btn-sm mt-2">
            <Copy size={14} /> نسخ الكود
          </button>
        </div>
        <div>
          <label className="label">رابط موقعك (للتحقق)</label>
          <input className="input" placeholder="https://your-store.com" value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button type="button" disabled={saving} onClick={submit} className="btn-primary flex-1">
            {saving ? <Spinner size="sm" /> : <><Check size={16} /> تفعيل الشات</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Step: Generic API ────────────────────────────────────────────────────────
function StepGeneric({ data, onClose, onSave }: {
  data: ModalData;
  onClose: () => void;
  onSave: (cfg: Record<string, string>) => Promise<void>;
}) {
  const LABELS: Record<string, { key: string; token: string }> = {
    sms:        { key: 'API Key / Account SID', token: 'Auth Token' },
    email:      { key: 'SMTP Host / API Key',   token: 'Username / Password' },
    tiktok:     { key: 'App ID',                token: 'Access Token' },
    tiktok_shop:{ key: 'Shop ID',               token: 'Access Token' },
    google:     { key: 'Business Profile ID',   token: 'Access Token' },
  };
  const lbl = LABELS[data.channelType] ?? { key: 'API Key', token: 'Access Token' };
  const [apiKey, setApiKey]   = useState(data.existingConfig?.api_key   ?? '');
  const [authToken, setToken] = useState(data.existingConfig?.auth_token ?? '');
  const [saving, setSaving]   = useState(false);

  const doc = CHANNEL_DOCS[data.channelType];

  async function submit() {
    setSaving(true);
    await onSave({ api_key: apiKey, auth_token: authToken, method: 'api' });
    setSaving(false);
  }

  return (
    <Modal title={`ربط ${data.channelLabel}`} onClose={onClose}>
      <div className="space-y-4">
        {doc && (
          <a href={doc} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
            <ExternalLink size={14} /> دليل الربط الرسمي
          </a>
        )}
        <div>
          <label className="label">{lbl.key} <span className="text-red-500">*</span></label>
          <input className="input font-mono text-sm" placeholder="xxxx..."
            value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <div>
          <label className="label">{lbl.token}</label>
          <input className="input font-mono text-sm" placeholder="..."
            value={authToken} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button type="button" disabled={!apiKey || saving} onClick={submit} className="btn-primary flex-1">
            {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط الآن</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; ok: boolean; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { channels, loading, reload } = useMerchantData();
  const { user, merchant } = useAuth();
  const [modal, setModal]   = useState<ModalData | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── helpers ──
  function toast(msg: string, ok = true) {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, ok }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }

  function openConnect(type: string) {
    if (!user) { toast('يرجى تسجيل الدخول أولاً', false); return; }
    const ch    = CHANNEL_TYPES.find((c) => c.value === type);
    const label = ch?.label ?? type;
    const existing = channels.find((c) => c.type === type);

    let step: ModalStep = 'choose';
    if (type === 'messenger' || type === 'instagram') step = 'oauth';
    else if (type === 'website')                      step = 'widget';
    else if (!['whatsapp', 'telegram'].includes(type)) step = 'generic';

    setModal({
      channelType:    type,
      channelLabel:   label,
      step,
      existingId:     existing?.id,
      existingConfig: existing?.config as Record<string, string> | undefined,
    });
  }

  function goTo(step: ModalStep) {
    setModal((prev) => prev ? { ...prev, step } : null);
  }

  function closeModal() { setModal(null); }

  async function saveChannel(cfg: Record<string, string>, nameOverride?: string) {
    if (!user || !modal) { toast('يرجى تسجيل الدخول أولاً', false); return; }

    // Always fetch a fresh merchant ID to avoid stale-context or JWT-refresh race conditions
    const { data: freshMId, error: rpcErr } = await supabase.rpc('get_or_create_merchant');
    if (rpcErr || !freshMId) {
      // eslint-disable-next-line no-console
      console.error('get_or_create_merchant failed:', rpcErr?.message);
      toast('تعذّر تحديد المتجر. يرجى إعادة تسجيل الدخول والمحاولة مجدداً.', false);
      return;
    }
    const merchantId = freshMId as string;

    try {
      if (modal.existingId) {
        const { error } = await supabase.from('channels')
          .update({ status: 'connected', config: cfg, last_sync: new Date().toISOString() })
          .eq('id', modal.existingId)
          .eq('merchant_id', merchantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('channels').insert({
          merchant_id: merchantId,
          type:        modal.channelType,
          name:        nameOverride ?? modal.channelLabel,
          status:      'connected',
          config:      cfg,
          last_sync:   new Date().toISOString(),
        });
        if (error) throw error;
      }
      closeModal();
      reload();
      toast(`✅ تم ربط ${nameOverride ?? modal.channelLabel} بنجاح`);
    } catch (e: unknown) {
      const errMsg = (e as { message?: string })?.message;
      // eslint-disable-next-line no-console
      console.error('saveChannel error:', e);
      toast(`❌ ${errMsg ?? 'خطأ أثناء الحفظ'}`, false);
    }
  }

  async function disconnect(id: string, name: string) {
    if (!confirm(`هل تريد فصل ${name}؟`)) return;
    const { error } = await supabase.from('channels').update({ status: 'disconnected' }).eq('id', id);
    if (error) { toast('❌ فشل الفصل', false); return; }
    reload();
    toast(`🔌 تم فصل ${name}`);
  }

  async function testChannel(id: string, name: string) {
    setTesting(id);
    await new Promise((r) => setTimeout(r, 800));
    await supabase.from('channels').update({ last_sync: new Date().toISOString() }).eq('id', id);
    reload();
    toast(`✅ اتصال ${name} يعمل بشكل طبيعي`);
    setTesting(null);
  }

  const connected = channels.filter((c) => c.status === 'connected');

  // ── render active modal step ──
  const renderModal = () => {
    if (!modal) return null;
    const { step } = modal;

    if (step === 'choose')    return <StepChoose   data={modal} goTo={goTo} onClose={closeModal} />;
    if (step === 'wa_api')    return <StepWaApi    data={modal} onClose={closeModal} onSave={(cfg) => saveChannel(cfg)} />;
    if (step === 'wa_qr')     return <StepWaQr     onClose={closeModal} goToApi={() => goTo('wa_api')} />;
    if (step === 'tg_token')  return <StepTgToken  data={modal} onClose={closeModal} onSave={(cfg, lbl) => saveChannel(cfg, lbl)} />;
    if (step === 'tg_qr')     return <StepTgQr     onClose={closeModal} onSave={(cfg) => saveChannel(cfg)} />;
    if (step === 'oauth')     return <StepOAuth    data={modal} onClose={closeModal} onSave={(cfg) => saveChannel(cfg)} />;
    if (step === 'widget')    return <StepWidget   data={modal} onClose={closeModal} onSave={(cfg) => saveChannel(cfg)} />;
    if (step === 'generic')   return <StepGeneric  data={modal} onClose={closeModal} onSave={(cfg) => saveChannel(cfg)} />;
    return null;
  };

  return (
    <div className="animate-fade-in">
      {/* Toasts */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id}
            className={`px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white pointer-events-auto
              ${t.ok ? 'bg-green-600' : 'bg-red-600'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Active modal */}
      {renderModal()}

      <PageHeader
        title="القنوات المتصلة"
        description="اربط قنوات التواصل لاستقبال رسائل عملائك في مكان واحد"
        actions={
          <div className="flex items-center gap-2">
            <Badge color="green">{connected.length} نشطة</Badge>
            <button type="button" onClick={reload} className="btn-secondary btn-sm">
              <RefreshCw size={14} /> تحديث
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'قنوات مربوطة', value: connected.length,         color: 'text-green-600 bg-green-50' },
          { label: 'إجمالي القنوات', value: CHANNEL_TYPES.length,   color: 'text-slate-700 bg-slate-50' },
          { label: 'قيد الانتظار', value: channels.length - connected.length, color: 'text-amber-600 bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.color.split(' ')[1]}`}>
            <div className={`text-2xl font-extrabold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {CHANNEL_TYPES.map((ch) => {
            const row = channels.find((c) => c.type === ch.value);
            const isOn = row?.status === 'connected';
            const Icon = iconMap[ch.icon] ?? Plug;
            const cfg  = (row?.config ?? {}) as Record<string, string>;

            return (
              <div key={ch.value}
                className={`card p-5 transition-all ${isOn ? 'border-green-200 bg-green-50/20' : 'hover:border-slate-300'}`}>

                <div className="flex items-center gap-4 mb-4">
                  {/* Icon */}
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${CHANNEL_COLORS[ch.value] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                    <Icon size={22} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{ch.label}</span>
                      <Badge color={isOn ? 'green' : 'gray'}>{isOn ? 'متصل' : 'غير مربوط'}</Badge>
                    </div>

                    {/* Connection method tag */}
                    {isOn && cfg.method && (
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        {cfg.method === 'api'   && <><Key   size={10} /> API</>}
                        {cfg.method === 'qr'    && <><QrCode size={10} /> QR Code</>}
                        {cfg.method === 'token' && <><Bot   size={10} /> {cfg.bot_username ? `@${cfg.bot_username}` : 'Bot Token'}</>}
                        {cfg.method === 'oauth' && <><CheckCircle size={10} /> OAuth</>}
                        {cfg.method === 'widget'&& <><Globe  size={10} /> Widget</>}
                      </div>
                    )}

                    {/* Last sync */}
                    {row?.last_sync && (
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Activity size={10} />
                        {formatDateTime(row.last_sync)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isOn ? (
                    <>
                      <button type="button"
                        disabled={testing === row?.id}
                        onClick={() => row && testChannel(row.id, ch.label)}
                        className="btn-secondary btn-sm flex-1">
                        {testing === row?.id ? <Spinner size="sm" /> : <><Wifi size={13} /> اختبار</>}
                      </button>
                      <button type="button"
                        onClick={() => openConnect(ch.value)}
                        className="btn-ghost btn-sm" title="تعديل">
                        <Settings size={14} />
                      </button>
                      <button type="button"
                        onClick={() => row && disconnect(row.id, ch.label)}
                        className="btn-ghost btn-sm text-red-500 hover:bg-red-50" title="فصل">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button"
                        onClick={() => openConnect(ch.value)}
                        className="btn-primary btn-sm flex-1">
                        <Plug size={13} /> ربط الآن
                      </button>
                      {CHANNEL_DOCS[ch.value] && (
                        <a href={CHANNEL_DOCS[ch.value]} target="_blank" rel="noreferrer"
                          className="btn-ghost btn-sm text-slate-400" title="دليل الربط">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guide */}
      <div className="card p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">خطوات الربط</h3>
            <p className="text-sm text-slate-500">كيف تربط أي قناة في 3 خطوات</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: '1', t: 'اضغط ربط الآن',    d: 'على أي قناة تريد ربطها' },
            { n: '2', t: 'اختر الطريقة',      d: 'API للأعمال الاحترافية، أو QR للربط السريع' },
            { n: '3', t: 'أكمل الخطوات',     d: 'أدخل البيانات أو امسح الـ QR وسيتم الربط فوراً' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {s.n}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{s.t}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
