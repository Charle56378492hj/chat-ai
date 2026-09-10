import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { MessageCircle, Save, Send, RefreshCw, AlertTriangle, Check, Power, Clock } from 'lucide-react';

export function WhatsAppSettingsPage() {
  const { channels, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const waChannel = channels.find((c) => c.type === 'whatsapp');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: (waChannel?.config as Record<string, string>)?.phone_number ?? '',
    welcomeMessage: 'أهلًا بك! كيف نقدر نساعدك اليوم؟ 😊',
    workHours: '9:00 - 22:00',
    lockAfterHours: false,
    autoReply: true,
    notifications: true,
  });

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    try {
      if (waChannel) {
        await supabase.from('channels').update({
          config: { phone_number: form.phoneNumber, welcome_message: form.welcomeMessage, work_hours: form.workHours, lock_after_hours: form.lockAfterHours, auto_reply: form.autoReply },
          status: form.phoneNumber ? 'connected' : 'disconnected',
        }).eq('id', waChannel.id);
      } else if (form.phoneNumber) {
        await supabase.from('channels').insert({
          merchant_id: merchant.id,
          type: 'whatsapp',
          name: 'واتساب',
          status: 'connected',
          config: { phone_number: form.phoneNumber, welcome_message: form.welcomeMessage, work_hours: form.workHours, lock_after_hours: form.lockAfterHours, auto_reply: form.autoReply },
        });
      }
      reload();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="إعدادات واتساب" description="ربط وتكوين قناة واتساب" />

      <div className="card p-4 mb-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><MessageCircle size={24} /></div>
        <div className="flex-1">
          <div className="font-bold text-slate-900">حالة الاتصال</div>
          <div className="text-sm text-slate-500">{waChannel?.status === 'connected' ? 'متصل ويعمل' : 'غير متصل'}</div>
        </div>
        <Badge color={waChannel?.status === 'connected' ? 'green' : 'red'}>{waChannel?.status === 'connected' ? 'متصل' : 'غير متصل'}</Badge>
      </div>

      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div>
          <h3 className="font-bold text-slate-900 mb-3">رقم واتساب</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">رقم الواتساب</label>
              <input className="input" placeholder="+966 5x xxx xxxx" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">طريقة الربط</label>
              <select className="input">
                <option>WhatsApp Business API</option>
                <option>QR Code</option>
                <option>Webhook</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 mb-3">رسالة الترحيب</h3>
          <textarea className="input min-h-[80px]" value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
        </div>

        <div>
          <h3 className="font-bold text-slate-900 mb-3">ساعات العمل</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ساعات العمل</label>
              <input className="input" value={form.workHours} onChange={(e) => setForm({ ...form, workHours: e.target.value })} />
            </div>
            <div>
              <label className="label">Webhook URL</label>
              <input className="input" placeholder="https://..." defaultValue={waChannel?.webhook_url ?? ''} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.lockAfterHours} onChange={(e) => setForm({ ...form, lockAfterHours: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-700">قفل الرسائل خارج الدوام (رد تلقائي)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoReply} onChange={(e) => setForm({ ...form, autoReply: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-700">الرد التلقائي بالذكاء الصناعي</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.notifications} onChange={(e) => setForm({ ...form, notifications: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-700">إرسال تنبيهات للرسائل الجديدة</span>
          </label>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <button type="button" className="btn-secondary"><Send size={16} /> إرسال رسالة تجريبية</button>
          <button type="button" className="btn-secondary"><RefreshCw size={16} /> اختبار الاتصال</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size="sm" /> : <><Save size={16} /> حفظ</>}</button>
        </div>
      </form>

      <div className="card p-4 mt-4 flex items-start gap-3 bg-amber-50 border-amber-200">
        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700">
          <div className="font-bold">تنبيه</div>
          <div>تأكد من التزامك بسياسات واتساب Business. الإرسال الجماعي غير المصرّح به قد يؤدي لحظر الرقم.</div>
        </div>
      </div>
    </div>
  );
}
