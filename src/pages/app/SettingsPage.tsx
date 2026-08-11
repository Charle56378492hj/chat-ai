import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Spinner } from '../../components/ui';
import { COUNTRIES } from '../../lib/constants';
import { Save, RotateCcw, Upload, Eye, Bell, Globe, Palette, FileText, Check } from 'lucide-react';

export function SettingsPage() {
  const { merchant, refreshMerchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    company_name: merchant?.company_name ?? '',
    country: merchant?.country ?? 'SA',
    currency: merchant?.currency ?? 'SAR',
    language: merchant?.language ?? 'ar',
    timezone: merchant?.timezone ?? 'Asia/Riyadh',
    phone: merchant?.phone ?? '',
    logo_url: merchant?.logo_url ?? '',
    brand_color: merchant?.brand_color ?? '#0EA5E9',
    default_reply: 'أهلًا بك! سنعاود لك في أقرب وقت.',
    signature: '- فريق المتجر',
  });

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    await supabase.from('merchants').update({
      company_name: form.company_name,
      country: form.country,
      currency: form.currency,
      language: form.language,
      timezone: form.timezone,
      phone: form.phone,
      logo_url: form.logo_url,
      brand_color: form.brand_color,
    }).eq('id', merchant.id);
    await refreshMerchant();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="الإعدادات" description="إعدادات حسابك ومتجرك" />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><FileText size={18} className="text-sky-500" /> معلومات الشركة</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">اسم الشركة</label>
              <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div>
              <label className="label">رقم الهاتف</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">الدولة</label>
              <select className="input" value={form.country} onChange={(e) => { setForm({ ...form, country: e.target.value }); const c = COUNTRIES.find((x) => x.value === e.target.value); if (c) setForm((f) => ({ ...f, currency: c.currency })); }}>
                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">العملة</label>
              <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div>
              <label className="label">اللغة</label>
              <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="label">المنطقة الزمنية</label>
              <input className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Palette size={18} className="text-violet-500" /> الهوية البصرية</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">رابط الشعار</label>
              <input className="input" placeholder="https://..." value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
            </div>
            <div>
              <label className="label">اللون الأساسي</label>
              <div className="flex gap-2">
                <input type="color" className="h-11 w-16 rounded-lg border border-slate-200" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
                <input className="input flex-1" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
              </div>
            </div>
          </div>
          <button className="btn-secondary btn-sm mt-3"><Upload size={14} /> رفع شعار</button>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Globe size={18} className="text-sky-500" /> الرد الافتراضي والتوقيع</h3>
          <div className="space-y-4">
            <div>
              <label className="label">الرد الافتراضي</label>
              <textarea className="input min-h-[60px]" value={form.default_reply} onChange={(e) => setForm({ ...form, default_reply: e.target.value })} />
            </div>
            <div>
              <label className="label">توقيع الرسائل</label>
              <input className="input" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Bell size={18} className="text-amber-500" /> التنبيهات</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-sm text-slate-700">تنبيهات البريد الإلكتروني</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-sm text-slate-700">تنبيهات الهاتف (Push)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="rounded" />
              <span className="text-sm text-slate-700">تنبيه عند كل رسالة جديدة</span>
            </label>
          </div>
          <button className="btn-secondary btn-sm mt-3"><Eye size={14} /> اختبار التنبيه</button>
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary"><RotateCcw size={16} /> استعادة الافتراضي</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner size="sm" /> : saved ? <><Check size={16} /> تم الحفظ</> : <><Save size={16} /> حفظ</>}
          </button>
        </div>
      </form>
    </div>
  );
}
