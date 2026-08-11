import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { Plus, Search, HelpCircle, MessageSquare, FileText, Video, Send, X, BookOpen, Bot, ShoppingCart } from 'lucide-react';

const guides = [
  { icon: Bot, title: 'دليل تدريب الذكاء', desc: 'كيف تدرّب مساعدك الذكي' },
  { icon: ShoppingCart, title: 'دليل الطلبات', desc: 'إدارة الطلبات من البداية للتسليم' },
  { icon: MessageSquare, title: 'دليل الربط', desc: 'ربط القنوات خطوة بخطوة' },
  { icon: FileText, title: 'دليل القوالب', desc: 'إنشاء واستخدام القوالب' },
];

const faqs = [
  { q: 'كيف أربط واتساب؟', a: 'اذهب لصفحة القنوات، اختر واتساب، أدخل رقمك، واتبع التعليمات.' },
  { q: 'كيف أدرّب الذكاء؟', a: 'من استوديو الذكاء، أضف سيناريوهات وأمثلة، ثم اختبر قبل النشر.' },
  { q: 'كيف أنشئ طلبًا من محادثة؟', a: 'افتح المحادثة، اضغط "إنشاء طلب"، واملأ البيانات.' },
  { q: 'كيف أضيف موظفًا؟', a: 'من صفحة الفريق، اضغط "إضافة عضو"، وأدخل بريده الإلكتروني.' },
];

export function HelpCenterPage() {
  const { loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [search, setSearch] = useState('');
  const [showTicket, setShowTicket] = useState(false);
  const [ticket, setTicket] = useState({ subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    await supabase.from('support_tickets').insert({ merchant_id: merchant.id, ...ticket });
    setSaving(false);
    setShowTicket(false);
    setTicket({ subject: '', body: '' });
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="مركز المساعدة"
        description="شروحات، فيديوهات، ودعم"
        actions={<button onClick={() => setShowTicket(true)} className="btn-primary btn-sm"><Plus size={16} /> فتح تذكرة</button>}
      />

      <div className="card p-6 mb-6 text-center gradient-bg">
        <HelpCircle size={40} className="text-sky-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">كيف نقدر نساعدك؟</h2>
        <div className="relative max-w-md mx-auto mt-4">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input className="input pr-10" placeholder="ابحث في مركز المساعدة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {guides.map((g) => (
          <div key={g.title} className="card p-5 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500 mb-3"><g.icon size={20} /></div>
            <div className="font-bold text-slate-900 text-sm">{g.title}</div>
            <div className="text-xs text-slate-500 mt-1">{g.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BookOpen size={18} className="text-sky-500" /> الأسئلة الشائعة</h3>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="font-semibold text-sm text-slate-900 mb-1">{f.q}</div>
                <p className="text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Video size={18} className="text-violet-500" /> فيديوهات تعليمية</h3>
          <div className="space-y-3">
            {['البداية السريعة', 'تدريب الذكاء', 'إدارة الطلبات', 'ربط القنوات'].map((v) => (
              <div key={v} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <div className="h-12 w-20 rounded-lg bg-slate-100 flex items-center justify-center"><Video size={20} className="text-slate-400" /></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{v}</div>
                  <div className="text-xs text-slate-500">5:30 دقيقة</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowTicket(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">فتح تذكرة دعم</h2>
              <button onClick={() => setShowTicket(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={submitTicket} className="p-6 space-y-4">
              <div>
                <label className="label">الموضوع *</label>
                <input className="input" required value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} />
              </div>
              <div>
                <label className="label">التفاصيل *</label>
                <textarea className="input min-h-[100px]" required value={ticket.body} onChange={(e) => setTicket({ ...ticket, body: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowTicket(false)} className="btn-secondary flex-1">إلغاء</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size="sm" /> : <><Send size={16} /> إرسال</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
