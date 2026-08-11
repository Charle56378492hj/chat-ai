import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';
import { ArrowRight, HelpCircle, Check } from 'lucide-react';
import { PRICING_PLANS } from '../../lib/constants';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">العودة للرئيسية</Link>
        </div>
      </header>

      <section className="py-16 md:py-24 gradient-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">أسعار تنمو معك</h1>
          <p className="text-lg text-slate-600 mb-8">ابدأ مجانًا وترقّى عند نموّك. بدون رسوم خفية، بدون عقود طويلة.</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 text-sm text-slate-600">
            <HelpCircle size={16} className="text-sky-500" /> غير متأكد؟ جرّب الخطة المجانية أولًا
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.id} className={`card p-6 relative flex flex-col ${plan.highlight ? 'ring-2 ring-sky-500 shadow-lg' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 right-6 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full">الأكثر شيوعًا</div>
                )}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <div className="mb-4">
                  {plan.price !== null ? (
                    <><span className="text-4xl font-extrabold text-slate-900">{plan.price}</span><span className="text-slate-500 text-sm"> ريال / {plan.period}</span></>
                  ) : (
                    <span className="text-3xl font-extrabold text-slate-900">مخصص</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
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

      {/* Comparison table */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-8 text-center">مقارنة تفصيلية</h2>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-right p-4 text-sm font-bold text-slate-700">الميزة</th>
                  <th className="text-center p-4 text-sm font-bold text-slate-500">مجاني</th>
                  <th className="text-center p-4 text-sm font-bold text-slate-500">أساسي</th>
                  <th className="text-center p-4 text-sm font-bold text-sky-600">احترافي</th>
                  <th className="text-center p-4 text-sm font-bold text-slate-500">مؤسسي</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['القنوات المتصلة', '1', '3', 'غير محدود', 'غير محدود'],
                  ['الرسائل الشهرية', '100', '5,000', 'غير محدود', 'غير محدود'],
                  ['أعضاء الفريق', '1', '5', 'غير محدود', 'غير محدود'],
                  ['ذكاء صناعي', 'أساسي', 'متقدم', 'متكامل', 'مخصص'],
                  ['الأتمتة المتقدمة', false, false, true, true],
                  ['تقارير وتحليلات', 'محدودة', 'كاملة', 'كاملة', 'كاملة'],
                  ['API كامل', false, false, true, true],
                  ['دعم فني', 'بريد', 'شات', 'أولوية 24/7', 'مدير مخصص'],
                  ['SLA', false, false, false, true],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-4 text-sm font-medium text-slate-700">{row[0]}</td>
                    {[1, 2, 3, 4].map((j) => (
                      <td key={j} className="p-4 text-center text-sm">
                        {row[j] === true ? <Check size={18} className="text-green-500 mx-auto" /> :
                         row[j] === false ? <span className="text-slate-300">—</span> :
                         <span className="text-slate-600">{row[j]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-8">
            <Link to="/contact" className="btn-secondary">
              تحدث مع المبيعات <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
