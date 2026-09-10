import { useCallback, useEffect, useState } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import {
  isWhatsAppGatewayConfigured, startWhatsAppSession, getWhatsAppStatus,
  logoutWhatsAppSession, WA_STATUS_LABEL, type WaSnapshot,
} from '../../lib/whatsappGateway';
import {
  isTelegramGatewayConfigured, startTelegramSession, getTelegramStatus,
  logoutTelegramSession, submitTelegramPassword, TG_STATUS_LABEL, type TelegramSnapshot,
} from '../../lib/telegramGateway';
import { MessageCircle, Send, Plug, RefreshCw, Trash2, QrCode, ShieldCheck, AlertTriangle } from 'lucide-react';

type ChannelKind = 'whatsapp' | 'telegram';
type Snapshot = WaSnapshot | TelegramSnapshot;

const labels: Record<ChannelKind, string> = { whatsapp: 'واتساب', telegram: 'تلغرام' };
const descriptions: Record<ChannelKind, string> = {
  whatsapp: 'اربط حساب واتساب عبر QR من هاتفك باستخدام بوابة Baileys.',
  telegram: 'اربط حساب تلغرام عبر QR، مع دعم التحقق بخطوتين.',
};

function QrCodeImage({ value, image }: { value?: string | null; image?: string | null }) {
  const src = image || (value ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(value)}` : '');
  if (!src) return null;
  return <img src={src} alt="QR code" width={240} height={240} className="mx-auto rounded-xl border border-slate-200" />;
}

export function ConnectionsPage() {
  const { merchant } = useAuth();
  const { channels, loading, reload } = useMerchantData();
  const [active, setActive] = useState<ChannelKind | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const channelFor = useCallback((kind: ChannelKind) => channels.find((c) => c.type === kind), [channels]);

  const ensureChannel = useCallback(async (kind: ChannelKind) => {
    if (!merchant) throw new Error('لم يتم تحميل المتجر بعد.');
    const existing = channelFor(kind);
    if (existing) return existing.id;
    const { data, error: insertError } = await supabase.from('channels').insert({
      merchant_id: merchant.id,
      type: kind,
      name: labels[kind],
      status: 'disconnected',
      config: { method: 'qr' },
    }).select('id').single();
    if (insertError || !data) throw new Error(insertError?.message || 'تعذر إنشاء القناة.');
    await reload();
    return data.id as string;
  }, [merchant, channelFor, reload]);

  const refreshStatus = useCallback(async (kind: ChannelKind, id: string) => {
    const next = kind === 'whatsapp' ? await getWhatsAppStatus(id) : await getTelegramStatus(id);
    setSnapshot(next);
    return next;
  }, []);

  async function openChannel(kind: ChannelKind) {
    setActive(kind); setError(''); setPassword(''); setSnapshot(null); setBusy(true);
    try {
      const id = await ensureChannel(kind);
      setActiveId(id);
      const next = kind === 'whatsapp' ? await startWhatsAppSession(id) : await startTelegramSession(id);
      setSnapshot(next);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء الجلسة.');
    } finally { setBusy(false); }
  }

  async function closeChannel() {
    setActive(null); setActiveId(null); setSnapshot(null); setError(''); setPassword('');
  }

  async function disconnect(kind: ChannelKind) {
    const channel = channelFor(kind);
    if (!channel) return;
    setBusy(true); setError('');
    try {
      if (kind === 'whatsapp') await logoutWhatsAppSession(channel.id);
      else await logoutTelegramSession(channel.id);
      await supabase.from('channels').update({ status: 'disconnected' }).eq('id', channel.id);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر فصل القناة.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!active || !activeId) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await refreshStatus(active, activeId);
        if (next.status === 'connected') await reload();
      } catch { /* يظهر الخطأ عند المحاولة التالية */ }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [active, activeId, refreshStatus, reload]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const configured = {
    whatsapp: isWhatsAppGatewayConfigured(),
    telegram: isTelegramGatewayConfigured(),
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="القنوات" description="اربط واتساب وتلغرام فقط لإدارة محادثات عملائك من مكان واحد." />
      <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 flex gap-3">
        <ShieldCheck className="shrink-0 text-sky-600" size={20} />
        <span>القنوات المدعومة في هذه النسخة هي <strong>واتساب وتلغرام</strong>. لا توجد تكاملات أخرى مفعّلة.</span>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {(['whatsapp', 'telegram'] as ChannelKind[]).map((kind) => {
          const channel = channelFor(kind);
          const Icon = kind === 'whatsapp' ? MessageCircle : Send;
          const connected = channel?.status === 'connected';
          return (
            <div key={kind} className="card p-6">
              <div className="flex items-start gap-4">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${kind === 'whatsapp' ? 'bg-green-100 text-green-600' : 'bg-sky-100 text-sky-600'}`}><Icon size={28} /></div>
                <div className="flex-1"><h2 className="text-lg font-bold text-slate-900">{labels[kind]}</h2><p className="text-sm text-slate-500 mt-1">{descriptions[kind]}</p></div>
                <Badge color={connected ? 'green' : 'gray'}>{connected ? 'متصل' : 'غير متصل'}</Badge>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Plug size={14} /> البوابة: {configured[kind] ? 'مضبوطة' : 'غير مضبوطة'}</div>
              {!configured[kind] && <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">أضف رابط البوابة في متغيرات البيئة قبل الربط.</div>}
              <div className="mt-5 flex gap-2">
                <button className="btn-primary flex-1" disabled={!configured[kind] || busy} onClick={() => void openChannel(kind)}>{connected ? <><RefreshCw size={16} /> إعادة فتح</> : <><QrCode size={16} /> ربط عبر QR</>}</button>
                {channel && <button className="btn-secondary" disabled={busy} onClick={() => void disconnect(kind)} title="فصل القناة"><Trash2 size={16} /></button>}
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50" onClick={() => void closeChannel()} /><div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold">ربط {labels[active]}</h2><button className="text-slate-500" onClick={() => void closeChannel()}>×</button></div>
          {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 p-3 text-sm flex gap-2"><AlertTriangle size={17} />{error}</div>}
          {busy && !snapshot && <div className="py-10 flex justify-center"><Spinner size="lg" /></div>}
          {snapshot && <div className="text-center space-y-4"><Badge color={snapshot.status === 'connected' ? 'green' : 'amber'}>{active === 'whatsapp' ? WA_STATUS_LABEL[snapshot.status as keyof typeof WA_STATUS_LABEL] : TG_STATUS_LABEL[snapshot.status as keyof typeof TG_STATUS_LABEL]}</Badge>{snapshot.status === 'qr' && <QrCodeImage value={active === 'whatsapp' ? (snapshot as WaSnapshot).qr : (snapshot as TelegramSnapshot).qr_value} image={snapshot.qr_image} />}{snapshot.status === 'password_required' && <div className="space-y-2"><input className="input" type="password" placeholder="كلمة مرور التحقق بخطوتين" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn-primary w-full" disabled={!password || !activeId} onClick={async () => { try { await submitTelegramPassword(activeId!, password); setPassword(''); await refreshStatus('telegram', activeId!); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال كلمة المرور.'); } }}>تأكيد كلمة المرور</button></div>}{snapshot.status === 'connected' && <p className="text-sm text-green-700">تم الاتصال بنجاح. يمكنك إغلاق هذه النافذة.</p>}<button className="btn-secondary w-full" onClick={() => void closeChannel()}>إغلاق</button></div>}
        </div></div>
      )}
    </div>
  );
}

export default ConnectionsPage;
