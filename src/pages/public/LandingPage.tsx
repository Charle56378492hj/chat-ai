import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, Bot, BarChart3, Shield, Zap, Users, Check, ArrowLeft,
  Star, TrendingUp, Clock, Headphones, ChevronDown, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { CHANNEL_TYPES, PRICING_PLANS } from '../../lib/constants';

const iconMap: Record<string, typeof MessageCircle> = {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music, ShoppingBag, Search,
};

const features = [
  { icon: Bot, title: 'ذكاء صناعي يبيع', desc: 'مساعد ذكي يفهم نية العميل، يرد بأدب وبطريقة بيع، ويحوّل المحادثة إلى طلب منظّم تلقائيًا.' },
  { icon: MessageCircle, title: 'كل القنوات في مكان واحد', desc: 'واتساب، ماسنجر، إنستغرام، تلغرام، شات الموقع، SMS، بريد، تيك توك، وGoogle Business — صندوق وارد موحّد.' },
  { icon: ShoppingBag, title: 'إدارة طلبات متكاملة', desc: 'من المحادثة إلى الطلب المؤكد إلى الشحن والتسليم، مع تتبع الحالة والمخزون والفواتير.' },
  { icon: BarChart3, title: 'تحليلات وتقارير', desc: 'مؤشرات المبيعات، أداء القنوات، نسبة إغلاق الذكاء، رضا العملاء، وأوقات الذروة.' },
  { icon: Zap, title: 'أتمتة متقدمة', desc: 'قواعد وسيناريوهات وWorkflows تحرّك العمل تلقائيًا: رد، متابعة، إنشاء طلب، تنبيه مخزون.' },
  { icon: Shield, title: 'أمان وامتثال', desc: 'مصادقة ثنائية، سجلات تدقيق كاملة، مفاتيح API، إدارة صلاحيات الفريق، وحماية البيانات.' },
];

const testimonials = [
  { name: 'أحمد العتيبي', company: 'متجر النخبة', text: 'زادت مبيعاتنا 40% بعد ربط واتساب بالذكاء. الذكاء يرد فوري ويلتقط الطلبات وأنا نائم!', rating: 5 },
  { name: 'سارة المطيري', company: 'بوتيك لافندر', text: 'وفّرت توظيف 3 موظفات دعم. الذكاء يغطي 80% من المحادثات والموظفين يتدخلون عند الحاجة فقط.', rating: 5 },
  { name: 'خالد الحربي', company: 'تك ستور', text: 'أفضل منصة جربتها. التكامل مع إنستغرام وتيك توك شوب سلس، والتقارير ممتازة.', rating: 5 },
];

const competitors = [
  { feature: 'رد آلي بالذكاء الصناعي', us: true, others: 'محدود' },
  { feature: 'تحويل المحادثة إلى طلب', us: true, others: false },
  { feature: 'صندوق وارد موحّد لكل القنوات', us: true, others: 'محدود' },
  { feature: 'تدريب الذكاء على أسلوبك', us: true, others: false },
  { feature: 'أتمتة Workflows متقدمة', us: true, others: 'محدود' },
  { feature: 'تحليلات لحظية', us: true, others: true },
  { feature: 'بوابة تتبع للزبون', us: true, others: false },
  { feature: 'دعم بالعربية', us: true, others: 'محدود' },
];

const faqs = [
  { q: 'هل أحتاج خبرة تقنية لاستخدام المنصة؟', a: 'لا، المنصة مصممة لأصحاب المتاجر بدون أي خلفية برمجية. تربط قنواتك بضغطة زر، والذكاء يبدأ الرد فورًا.' },
  { q: 'هل يدعم اللهجات العربية؟', a: 'نعم، الذكاء يدعم العربية الفصحى وجميع اللهجات (سعودية، مصرية، شامية، خليجية، مغاربية) ويفهم رسائل العملاء بأي لهجة.' },
  { q: 'كيف أتحكم في ردود الذكاء؟', a: 'تحدد سياسة الرد، ولهجة المساعد، وقواعد الأتمتة، وتدرّبه على أمثلة. يمكنك إيقاف الذكاء في أي محادثة وتحويلها لموظف.' },
  { q: 'ما القنوات المدعومة؟', a: 'واتساب، فيسبوك ماسنجر، إنستغرام DM، تلغرام، شات الموقع، SMS، بريد إلكتروني، تيك توك، تيك توك شوب، وGoogle Business Chat.' },
  { q: 'هل بياناتي آمنة؟', a: 'نعم، جميع البيانات مشفّرة، ونفعّل مصادقة ثنائية، وسجلات تدقيق كاملة، وصلاحيات دقيقة للفريق.' },
  { q: 'هل يمكنني الإلغاء في أي وقت؟', a: 'نعم، لا توجد عقود طويلة. تترقى أو تخفّض أو تلغي اشتراكك في أي وقت من لوحة التحكم.' },
];

export function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-slate-900">المميزات</a>
            <Link to="/pricing" className="text-sm font-semibold text-slate-600 hover:text-slate-900">التسعير</Link>
            <a href="#faq" className="text-sm font-semibold text-slate-600 hover:text-slate-900">الأسئلة الشائعة</a>
            <Link to="/contact" className="text-sm font-semibold text-slate-600 hover:text-slate-900">تواصل معنا</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="btn-ghost btn-sm">تسجيل الدخول</Link>
            <Link to="/auth?mode=signup" className="btn-primary btn-sm">ابدأ الآن</Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm font-semibold text-slate-600">المميزات</a>
            <Link to="/pricing" onClick={() => setMobileMenu(false)} className="block text-sm font-semibold text-slate-600">التسعير</Link>
            <a href="#faq" onClick={() => setMobileMenu(false)} className="block text-sm font-semibold text-slate-600">الأسئلة الشائعة</a>
            <Link to="/contact" className="block text-sm font-semibold text-slate-600">تواصل معنا</Link>
            <div className="flex gap-2 pt-2">
              <Link to="/auth" className="btn-secondary btn-sm flex-1">تسجيل الدخول</Link>
              <Link to="/auth?mode=signup" className="btn-primary btn-sm flex-1">ابدأ الآن</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-bg hero-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-sm font-semibold text-sky-700 mb-6 animate-fade-in">
              <Zap size={14} /> منصة ذكاء صناعي للمحادثات والمبيعات
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6 animate-fade-in">
              حوّل محادثاتك إلى <span className="gradient-text">مبيعات تلقائية</span>
              <br /> بالذكاء الصناعي
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto animate-fade-in">
              منصة واحدة تربط كل قنواتك — واتساب، ماسنجر، إنستغرام، تلغرام وأكثر —
              ويرد الذكاء الصناعي على عملائك، يلتقط الطلبات، ويدير مبيعاتك على autopilot.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 animate-fade-in">
              <Link to="/auth?mode=signup" className="btn-primary btn-lg w-full sm:w-auto">
                ابدأ الآن مجانًا <ArrowLeft size={18} />
              </Link>
              <Link to="/demo" className="btn-secondary btn-lg w-full sm:w-auto">
                شاهد الديمو
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> بدون بطاقة ائتمان</span>
              <span className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> إعداد في 5 دقائق</span>
              <span className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> دعم بالعربية</span>
            </div>
          </div>

          {/* Channels strip */}
          <div className="mt-16">
            <p className="text-center text-sm font-semibold text-slate-400 mb-6">يربط جميع قنواتك في مكان واحد</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {CHANNEL_TYPES.map((ch) => {
                const Icon = iconMap[ch.icon] ?? MessageCircle;
                return (
                  <div key={ch.value} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                    <Icon size={18} className="text-sky-500" />
                    <span className="text-sm font-semibold text-slate-700">{ch.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '+10M', label: 'رسالة معالجة' },
            { value: '+5000', label: 'تاجر نشط' },
            { value: '85%', label: 'نسبة الإغلاق الآلي' },
            { value: '24/7', label: 'رد فوري' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-extrabold gradient-text">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">كل ما تحتاجه لإدارة محادثاتك ومبيعاتك</h2>
            <p className="text-lg text-slate-600">منصة متكاملة من الصفر إلى البيع، بُنيت للتجار الذين يريدون النمو.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6 hover:shadow-lg transition-shadow group">
                <div className="h-12 w-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500 mb-4 group-hover:bg-sky-100 transition-colors">
                  <f.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat Demo Preview */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">شاهد الذكاء وهو يبيع</h2>
            <p className="text-lg text-slate-600">مثال حقيقي على محادثة يلتقط فيها الذكاء طلبًا كاملًا</p>
          </div>
          <div className="card p-6 max-w-md mx-auto">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">ع</div>
                <div className="bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">بكم الجاكيت الأزرق؟</div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-sky-500 text-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[80%]">
                  أهلًا! الجاكيت الأزرق بـ 249 ريال. متوفر بالمقاسات S وM وL. تحب أطلب لك واحد؟ 😊
                </div>
                <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">ع</div>
                <div className="bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">نعم مقاس M وعنواني حي النرجس بالرياض</div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-sky-500 text-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[80%]">
                  تمام! سجّلت طلبك: جاكيت أزرق مقاس M — 249 ريال + 25 ريال توصيل = 274 ريال. الدفع عند الاستلام. أكدّ الطلب؟
                </div>
                <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
                <Check size={14} className="text-green-500" /> تم إنشاء الطلب #1024 تلقائيًا
              </div>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link to="/demo" className="btn-secondary">جرّب الديمو التفاعلي <ArrowLeft size={16} /></Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">تجار يثقون بنا</h2>
            <p className="text-lg text-slate-600">آلاف المتاجر تستخدم منصتنا لتنمية مبيعاتها</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">لماذا نحن؟</h2>
            <p className="text-lg text-slate-600">قارن بين منصتنا والحلول الأخرى</p>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-right p-4 text-sm font-bold text-slate-700">الميزة</th>
                  <th className="text-center p-4 text-sm font-bold text-sky-600">ردّآلي</th>
                  <th className="text-center p-4 text-sm font-bold text-slate-400">المنافسون</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => (
                  <tr key={c.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-4 text-sm font-medium text-slate-700">{c.feature}</td>
                    <td className="p-4 text-center">
                      {c.us === true ? <Check size={20} className="text-green-500 mx-auto" /> : <span className="text-slate-400 text-sm">{c.us}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {c.others === true ? <Check size={20} className="text-green-500 mx-auto" /> :
                       c.others === false ? <X size={18} className="text-slate-300 mx-auto" /> :
                       <span className="text-amber-600 text-sm font-medium">{c.others}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">أسعار بسيطة وشفافة</h2>
            <p className="text-lg text-slate-600">ابدأ مجانًا وترقّى عند نموّك. بدون رسوم خفية.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.id} className={`card p-6 relative ${plan.highlight ? 'ring-2 ring-sky-500 shadow-lg' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 right-6 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full">الأكثر شيوعًا</div>
                )}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <div className="mb-4">
                  {plan.price !== null ? (
                    <><span className="text-3xl font-extrabold text-slate-900">{plan.price}</span><span className="text-slate-500 text-sm"> ريال / {plan.period}</span></>
                  ) : (
                    <span className="text-2xl font-extrabold text-slate-900">مخصص</span>
                  )}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.id === 'enterprise' ? '/contact' : '/auth?mode=signup'} className={`w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">الأسئلة الشائعة</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-right"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-bold text-slate-900">{faq.q}</span>
                  <ChevronDown size={20} className={`text-slate-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed animate-fade-in">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 p-10 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 hero-grid opacity-20" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">جاهز تضاعف مبيعاتك؟</h2>
              <p className="text-lg text-sky-100 mb-8 max-w-xl mx-auto">ابدأ اليوم مجانًا. اربط قناتك، درّب الذكاء، ودع مبيعاتك تعمل 24/7.</p>
              <Link to="/auth?mode=signup" className="btn bg-white text-sky-600 hover:bg-sky-50 btn-lg font-bold">
                ابدأ الآن مجانًا <ArrowLeft size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo variant="light" />
              <p className="text-sm mt-4 max-w-xs">منصة ذكاء صناعي لإدارة المحادثات والطلبات والمبيعات عبر كل القنوات.</p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-3">المنتج</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">المميزات</a></li>
                <li><Link to="/pricing" className="hover:text-white">التسعير</Link></li>
                <li><Link to="/demo" className="hover:text-white">الديمو</Link></li>
                <li><Link to="/auth?mode=signup" className="hover:text-white">إنشاء حساب</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-3">الشركة</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/contact" className="hover:text-white">تواصل معنا</Link></li>
                <li><a href="#" className="hover:text-white">المدونة</a></li>
                <li><a href="#" className="hover:text-white">الوظائف</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-3">قانوني</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">الشروط والأحكام</a></li>
                <li><a href="#" className="hover:text-white">سياسة الخصوصية</a></li>
                <li><a href="#" className="hover:text-white">سياسة الاسترجاع</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-sm text-center">
            © 2026 ردّآلي. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
}
