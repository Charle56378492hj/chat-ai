import { Link } from 'react-router-dom';
import { Logo, Badge } from '../../components/ui';
import { useState } from 'react';
import { Bot, Send, ArrowRight, RotateCcw, Check } from 'lucide-react';

interface DemoMessage {
  sender: 'customer' | 'ai';
  text: string;
}

const scenarios = [
  {
    id: 'price',
    label: 'سؤال عن السعر',
    messages: [
      { sender: 'customer' as const, text: 'بكم التيشيرت الأحمر؟' },
      { sender: 'ai' as const, text: 'أهلًا بك! التيشيرت الأحمر بـ 89 ريال، متوفر بمقاسات S/M/L/XL. تحب أطلب لك واحد؟ 😊' },
      { sender: 'customer' as const, text: 'نعم مقاس L' },
      { sender: 'ai' as const, text: 'تمام! سجّلت طلبك: تيشيرت أحمر مقاس L — 89 ريال. وين التوصيل؟' },
    ],
  },
  {
    id: 'angry',
    label: 'عميل غاضب',
    messages: [
      { sender: 'customer' as const, text: 'طلبي تأخر 5 أيام! هذا غير مقبول' },
      { sender: 'ai' as const, text: 'أعتذر بشدة عن التأخر، هذا ليس مستوانا. دعني أتابع طلبك فورًا وأعطيك تحديث خلال دقائق. رقم الطلب؟' },
      { sender: 'customer' as const, text: '1024' },
      { sender: 'ai' as const, text: 'شكرًا. طلبتك قيد التجهيز وستصلك غدًا. سأحولك لموظف لمتابعة خاصة وخصم 10% على طلبك القادم.' },
    ],
  },
  {
    id: 'discount',
    label: 'طلب خصم',
    messages: [
      { sender: 'customer' as const, text: 'لو أخدت 3 قطع تعطيني خصم؟' },
      { sender: 'ai' as const, text: 'أكيد! عندنا عرض: اشترِ 3 وادفع لـ 2. يعني توفّر 33%. تحب أجهّز لك الطلب؟' },
      { sender: 'customer' as const, text: 'تمام أعجبني' },
      { sender: 'ai' as const, text: 'ممتاز! اختر الألوان والمقاسات وأنا أسجّلها لك.' },
    ],
  },
];

export function DemoPage() {
  const [activeScenario, setActiveScenario] = useState(scenarios[0]);
  const [visibleMessages, setVisibleMessages] = useState<DemoMessage[]>([]);
  const [typing, setTyping] = useState(false);

  function playScenario() {
    setVisibleMessages([]);
    setTyping(false);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= activeScenario.messages.length) {
        clearInterval(interval);
        return;
      }
      const msg = activeScenario.messages[idx];
      if (msg.sender === 'ai') {
        setTyping(true);
        setTimeout(() => {
          setTyping(false);
          setVisibleMessages((prev) => [...prev, msg]);
        }, 800);
      } else {
        setVisibleMessages((prev) => [...prev, msg]);
      }
      idx++;
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">العودة للرئيسية</Link>
        </div>
      </header>

      <section className="py-16 gradient-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Badge color="sky"><Bot size={14} /> ديمو تفاعلي</Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-4 mb-3">جرّب الذكاء بنفسك</h1>
          <p className="text-slate-600">اختر سيناريو وشاهد الذكاء الصناعي يرد ويلتقط الطلب</p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveScenario(s); setVisibleMessages([]); setTyping(false); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeScenario.id === s.id ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">مساعد المتجر</div>
                <div className="text-xs text-green-600 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> متصل</div>
              </div>
            </div>
            <div className="p-4 min-h-[400px] flex flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto">
                {visibleMessages.length === 0 && !typing && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <Bot size={40} className="mb-3" />
                    <p className="text-sm">اضغط "تشغيل" لبدء المحادثة</p>
                  </div>
                )}
                {visibleMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.sender === 'ai' ? 'justify-end' : ''} animate-fade-in`}>
                    {msg.sender === 'customer' && (
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">ع</div>
                    )}
                    <div className={`rounded-2xl px-4 py-2.5 text-sm max-w-[80%] ${msg.sender === 'ai' ? 'bg-sky-500 text-white rounded-tl-sm' : 'bg-slate-100 text-slate-800 rounded-tr-sm'}`}>
                      {msg.text}
                    </div>
                    {msg.sender === 'ai' && (
                      <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {typing && (
                  <div className="flex gap-2 justify-end">
                    <div className="bg-sky-500 text-white rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={playScenario} className="btn-primary flex-1">
                  <RotateCcw size={16} /> تشغيل المحادثة
                </button>
                <Link to="/auth?mode=signup" className="btn-secondary">
                  ابدأ الآن <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: Check, label: 'فهم النية', desc: 'يحلل رسالة العميل' },
              { icon: Check, label: 'استخراج البيانات', desc: 'يلتقط المنتج والمقاس' },
              { icon: Check, label: 'إنشاء الطلب', desc: 'يحوّلها لطلب رسمي' },
            ].map((f) => (
              <div key={f.label} className="card p-4 text-center">
                <f.icon size={20} className="text-green-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-900">{f.label}</div>
                <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
