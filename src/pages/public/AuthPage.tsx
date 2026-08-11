import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo, Spinner } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { COUNTRIES } from '../../lib/constants';
import { Mail, Lock, Phone, Building2, MapPin, Briefcase, ArrowLeft, AlertCircle } from 'lucide-react';

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('SA');
  const [businessType, setBusinessType] = useState('retail');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
        else navigate('/app');
      } else {
        const { error } = await signUp(email, password, {
          company_name: companyName,
          phone,
          country,
          business_type: businessType,
        });
        if (error) setError(error);
        else navigate('/onboarding');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-bg hero-grid p-12 flex-col justify-between">
        <Logo size="lg" />
        <div>
          <h2 className="text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            أهلاً بك في عالم<br /><span className="gradient-text">المبيعات التلقائية</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-md">
            اربط قنواتك، درّب ذكاءك، ودع عملاءك يحصلون على ردود فورية وطلبات منظّمة على مدار الساعة.
          </p>
          <div className="mt-8 space-y-3">
            {['إعداد في 5 دقائق', 'بدون بطاقة ائتمان', 'دعم بالعربية 24/7'].map((t) => (
              <div key={t} className="flex items-center gap-2 text-slate-700">
                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</div>
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">© 2026 ردّآلي</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo size="lg" /></div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h1>
          <p className="text-slate-500 mb-6">
            {mode === 'login' ? 'أهلاً بعودتك! أدخل بياناتك للمتابعة.' : 'ابدأ تجربتك المجانية اليوم.'}
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="label">اسم الشركة</label>
                  <div className="relative">
                    <Building2 size={18} className="absolute right-3 top-3 text-slate-400" />
                    <input className="input pr-10" placeholder="متجر النخبة" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="label">رقم الهاتف</label>
                  <div className="relative">
                    <Phone size={18} className="absolute right-3 top-3 text-slate-400" />
                    <input className="input pr-10" placeholder="+966 5x xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">الدولة</label>
                    <div className="relative">
                      <MapPin size={18} className="absolute right-3 top-3 text-slate-400" />
                      <select className="input pr-10 appearance-none" value={country} onChange={(e) => setCountry(e.target.value)}>
                        {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">نوع النشاط</label>
                    <div className="relative">
                      <Briefcase size={18} className="absolute right-3 top-3 text-slate-400" />
                      <select className="input pr-10 appearance-none" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                        <option value="retail">تجزئة</option>
                        <option value="food">مطاعم</option>
                        <option value="fashion">أزياء</option>
                        <option value="electronics">إلكترونيات</option>
                        <option value="services">خدمات</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-3 text-slate-400" />
                <input type="email" className="input pr-10" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-3 text-slate-400" />
                <input type="password" className="input pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-sm text-sky-600 hover:text-sky-700 font-semibold">نسيت كلمة المرور؟</button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size="sm" /> : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
              {!loading && <ArrowLeft size={18} />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">أو</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="btn-secondary" onClick={() => setError('تسجيل الدخول بـ Google غير مفعل في البيئة التجريبية')}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button className="btn-secondary" onClick={() => setError('تسجيل الدخول بـ Facebook غير مفعل في البيئة التجريبية')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
              Facebook
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }} className="text-sky-600 hover:text-sky-700 font-bold">
              {mode === 'login' ? 'أنشئ حسابًا' : 'سجّل الدخول'}
            </button>
          </p>
          <p className="text-center text-xs text-slate-400 mt-4">
            بإنشائك حسابًا، أنت توافق على <Link to="#" className="underline">الشروط</Link> و<Link to="#" className="underline">الخصوصية</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
