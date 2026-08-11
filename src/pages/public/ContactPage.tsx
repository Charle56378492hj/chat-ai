import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';
import { Mail, Phone, MapPin, MessageCircle, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function ContactPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">العودة للرئيسية</Link>
        </div>
      </header>

      <section className="py-16 md:py-24 gradient-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">تحدث مع المبيعات</h1>
          <p className="text-lg text-slate-600 mb-8">فريقنا جاهز لمساعدتك في اختيار الخطة المناسبة لعملك.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-6">معلومات التواصل</h2>
            <div className="space-y-4">
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500"><Mail size={22} /></div>
                <div>
                  <div className="font-bold text-slate-900">البريد</div>
                  <div className="text-sm text-slate-500">sales@raddali.com</div>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center text-green-500"><Phone size={22} /></div>
                <div>
                  <div className="font-bold text-slate-900">الهاتف</div>
                  <div className="text-sm text-slate-500">+966 11 234 5678</div>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500"><MapPin size={22} /></div>
                <div>
                  <div className="font-bold text-slate-900">العنوان</div>
                  <div className="text-sm text-slate-500">الرياض، المملكة العربية السعودية</div>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500"><MessageCircle size={22} /></div>
                <div>
                  <div className="font-bold text-slate-900">واتساب</div>
                  <div className="text-sm text-slate-500">+966 50 123 4567</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            {sent ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4">
                  <Send size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">تم إرسال رسالتك!</h3>
                <p className="text-slate-500">سنتواصل معك خلال 24 ساعة.</p>
                <Link to="/" className="btn-secondary mt-6">العودة للرئيسية</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">أرسل لنا رسالة</h2>
                <div>
                  <label className="label">الاسم</label>
                  <input className="input" required placeholder="اسمك الكامل" />
                </div>
                <div>
                  <label className="label">البريد</label>
                  <input type="email" className="input" required placeholder="you@company.com" />
                </div>
                <div>
                  <label className="label">الشركة</label>
                  <input className="input" placeholder="اسم الشركة" />
                </div>
                <div>
                  <label className="label">حجم الفريق</label>
                  <select className="input">
                    <option>1-10 موظفين</option>
                    <option>11-50 موظفًا</option>
                    <option>51-200 موظفًا</option>
                    <option>+200 موظف</option>
                  </select>
                </div>
                <div>
                  <label className="label">رسالتك</label>
                  <textarea className="input min-h-[100px]" required placeholder="كيف يمكننا مساعدتك؟" />
                </div>
                <button type="submit" className="btn-primary w-full">إرسال <Send size={16} /></button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
