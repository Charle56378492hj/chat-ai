import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, Spinner } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { CHANNEL_TYPES, COUNTRIES } from '../../lib/constants';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, Headphones, Package, Truck, Wrench, ArrowRight, ArrowLeft, Check,
} from 'lucide-react';

const iconMap: Record<string, typeof MessageCircle> = {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music, ShoppingBag, Search,
};

const goals = [
  { id: 'support', label: 'دعم عملاء', icon: Headphones },
  { id: 'sales', label: 'مبيعات', icon: ShoppingBag },
  { id: 'orders', label: 'استلام طلبات', icon: Package },
  { id: 'booking', label: 'حجز مواعيد', icon: Check },
  { id: 'tracking', label: 'تتبع شحنات', icon: Truck },
  { id: 'aftersales', label: 'خدمة ما بعد البيع', icon: Wrench },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshMerchant } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState('');
  const [businessType, setBusinessType] = useState('retail');
  const [language, setLanguage] = useState('ar');
  const [country, setCountry] = useState('SA');
  const [currency, setCurrency] = useState('SAR');
  const [autoMode, setAutoMode] = useState('full');

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp']);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['sales']);

  const [storeName, setStoreName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [workHours, setWorkHours] = useState('9:00 - 22:00');
  const [cities, setCities] = useState('');
  const [paymentMethods, setPaymentMethods] = useState('cash');
  const [deliveryPolicy, setDeliveryPolicy] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');

  const steps = ['الترحيب', 'القنوات', 'الأهداف', 'البيانات الأساسية'];

  async function ensureMerchant(): Promise<string | null> {
    if (!user) return null;
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (merchant?.id) return merchant.id;

    const { data: created } = await supabase
      .from('merchants')
      .insert({
        owner_id: user.id,
        company_name: projectName || 'متجري',
        country,
        currency,
        language,
        business_type: businessType,
        phone: supportPhone || null,
      })
      .select('id')
      .single();

    return created?.id ?? null;
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const merchantId = await ensureMerchant();

      if (merchantId) {
        await supabase.from('merchants').update({
          company_name: storeName || projectName || 'متجري',
          country,
          currency,
          language,
          business_type: businessType,
          phone: supportPhone,
        }).eq('id', merchantId);

        for (const ch of selectedChannels) {
          await supabase.from('channels').insert({
            merchant_id: merchantId,
            type: ch,
            name: CHANNEL_TYPES.find((c) => c.value === ch)?.label ?? ch,
            status: 'pending',
          });
        }

        await supabase.from('subscriptions').insert({
          merchant_id: merchantId,
          plan: 'free',
          status: 'active',
        });

        await supabase.from('ai_configs').insert({
          merchant_id: merchantId,
          mode: autoMode === 'full' ? 'sales' : 'support',
        });
      }
      await refreshMerchant();
      navigate('/app');
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    if (!user) return;
    setSaving(true);
    try {
      await ensureMerchant();
      await refreshMerchant();
      navigate('/app');
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }
  function toggleGoal(g: string) {
    setSelectedGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="border-b border-slate-100 bg-white/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="text-sm text-slate-500">الخطوة {step + 1} من {steps.length}</div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-sky-500' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>

        <div className="card p-6 md:p-8 animate-fade-in">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">أهلًا بك! لنبدأ الإعداد</h2>
                <p className="text-slate-500">أخبرنا قليلًا عن مشروعك لنضبط كل شيء لك.</p>
              </div>
              <div>
                <label className="label">ما اسم مشروعك؟</label>
                <input className="input" placeholder="متجري" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">نوع النشاط</label>
                  <select className="input" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                    <option value="retail">تجزئة</option>
                    <option value="food">مطاعم</option>
                    <option value="fashion">أزياء</option>
                    <option value="electronics">إلكترونيات</option>
                    <option value="services">خدمات</option>
                  </select>
                </div>
                <div>
                  <label className="label">لغة الرد</label>
                  <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="ar_en">عربي + إنجليزي</option>
                  </select>
                </div>
                <div>
                  <label className="label">الدولة</label>
                  <select className="input" value={country} onChange={(e) => { setCountry(e.target.value); const c = COUNTRIES.find((x) => x.value === e.target.value); if (c) setCurrency(c.currency); }}>
                    {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">العملة</label>
                  <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">نوع الرد الآلي</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAutoMode('full')} className={`p-4 rounded-xl border-2 text-right transition-all ${autoMode === 'full' ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}>
                    <div className="font-bold text-slate-900">رد آلي كامل</div>
                    <div className="text-xs text-slate-500 mt-1">الذكاء يرد على كل الرسائل</div>
                  </button>
                  <button onClick={() => setAutoMode('semi')} className={`p-4 rounded-xl border-2 text-right transition-all ${autoMode === 'semi' ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}>
                    <div className="font-bold text-slate-900">نصف آلي</div>
                    <div className="text-xs text-slate-500 mt-1">الذكاء يقترح والموظف يؤكد</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Channels */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">اختر القنوات التي تريد ربطها</h2>
                <p className="text-slate-500">يمكنك ربطها الآن أو لاحقًا من الإعدادات.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CHANNEL_TYPES.map((ch) => {
                  const Icon = iconMap[ch.icon] ?? MessageCircle;
                  const selected = selectedChannels.includes(ch.value);
                  return (
                    <button
                      key={ch.value}
                      onClick={() => toggleChannel(ch.value)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <Icon size={24} className={selected ? 'text-sky-500' : 'text-slate-400'} />
                      <span className="text-sm font-semibold text-slate-700">{ch.label}</span>
                      {selected && <Check size={16} className="text-sky-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">ما أهدافك من المنصة؟</h2>
                <p className="text-slate-500">اختر كل ما ينطبق — سنضبط الذكاء بناءً عليه.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {goals.map((g) => {
                  const selected = selectedGoals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGoal(g.id)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <g.icon size={24} className={selected ? 'text-sky-500' : 'text-slate-400'} />
                      <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                      {selected && <Check size={16} className="text-sky-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Basic data */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">البيانات الأساسية لمتجرك</h2>
                <p className="text-slate-500">هذه المعلومات ستساعد الذكاء على الرد بدقة.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">اسم المتجر</label>
                  <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={projectName || 'متجري'} />
                </div>
                <div>
                  <label className="label">رقم الدعم</label>
                  <input className="input" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+966 5x xxx xxxx" />
                </div>
                <div>
                  <label className="label">ساعات العمل</label>
                  <input className="input" value={workHours} onChange={(e) => setWorkHours(e.target.value)} placeholder="9:00 - 22:00" />
                </div>
                <div>
                  <label className="label">المدن المخدومة</label>
                  <input className="input" value={cities} onChange={(e) => setCities(e.target.value)} placeholder="الرياض، جدة، الدمام" />
                </div>
                <div>
                  <label className="label">طرق الدفع</label>
                  <select className="input" value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)}>
                    <option value="cash">الدفع عند الاستلام</option>
                    <option value="card">بطاقة</option>
                    <option value="transfer">تحويل بنكي</option>
                    <option value="all">الكل</option>
                  </select>
                </div>
                <div>
                  <label className="label">سياسة التوصيل</label>
                  <input className="input" value={deliveryPolicy} onChange={(e) => setDeliveryPolicy(e.target.value)} placeholder="توصيل خلال 2-3 أيام" />
                </div>
              </div>
              <div>
                <label className="label">سياسة الاسترجاع</label>
                <textarea className="input min-h-[80px]" value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} placeholder="يمكن الإرجاع خلال 7 أيام..." />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : null}
              disabled={step === 0}
              className="btn-ghost"
            >
              <ArrowRight size={18} /> رجوع
            </button>
            <div className="flex gap-2">
              <button onClick={skip} disabled={saving} className="btn-ghost text-sm">تخطي لاحقًا</button>
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(step + 1)} className="btn-primary">
                  التالي <ArrowLeft size={18} />
                </button>
              ) : (
                <button onClick={finish} disabled={saving} className="btn-primary">
                  {saving ? <Spinner size="sm" /> : <>إنهاء الإعداد <Check size={18} /></>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
