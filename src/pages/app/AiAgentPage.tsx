import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { sendAgentMessage } from '../../lib/aiAgentActions';
import { Badge, PageHeader, Spinner } from '../../components/ui';
import {
  ArrowUp, Bot, Check, ChevronLeft, Clock3, HelpCircle, Command, Facebook,
  Instagram, Mail, MessageCircle, MoreHorizontal, Package,
  Radio, Send, ShoppingCart, Sparkles, Workflow, Zap,
} from 'lucide-react';

type Message = { id: number; role: 'assistant' | 'merchant'; text: string; time: string; action?: string };
type Channel = { id: string; type: string; name?: string; is_active?: boolean };

const channelMeta: Record<string, { label: string; icon: typeof Facebook; color: string }> = {
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600 bg-blue-50' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600 bg-pink-50' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  email: { label: 'البريد الإلكتروني', icon: Mail, color: 'text-amber-600 bg-amber-50' },
  telegram: { label: 'Telegram', icon: Send, color: 'text-sky-600 bg-sky-50' },
};

const suggestions = [
  { icon: Zap, title: 'أنشئ workflow', text: 'عند وصول رسالة على Facebook أرسل تنبيهاً على البريد' },
  { icon: ShoppingCart, title: 'تابع الطلبات', text: 'اعرض لي الطلبات الجديدة التي تحتاج متابعة' },
  { icon: Package, title: 'حلّل المخزون', text: 'ما هي المنتجات التي اقترب مخزونها من النفاد؟' },
  { icon: Sparkles, title: 'أتمتة ذكية', text: 'اقترح أتمتة لتحسين سرعة الرد على العملاء' },
];

function now() {
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function trimmedPhone(text: string) {
  const match = text.match(/(?:\+?\d[\d\s-]{7,})/);
  return match?.[0]?.replace(/[^\d+]/g, '') ?? '';
}

function nextRunAt(hour: number) {
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export function AiAgentPage() {
  const { merchant } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [stats, setStats] = useState({ products: 0, orders: 0, conversations: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: `أهلاً! أنا وكيل متجرك الذكي. فيني أتحكم بالقنوات، الطلبات، المنتجات، المحادثات، وأبني workflows من كلامك مباشرة. شو بتحب نعمل اليوم؟`, time: now() },
  ]);
  const [workflow, setWorkflow] = useState<{ name: string; steps: string[] } | null>(null);
  const [pendingSend, setPendingSend] = useState<{ channel: Channel; to: string; text: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingSchedule, setPendingSchedule] = useState<{ channelId: string; recipient: string; hour: number; instruction: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const merchantId = merchant?.id;
    if (!merchantId) return;
    let active = true;
    async function load() {
      setLoading(true);
      const [channelRes, productRes, orderRes, conversationRes] = await Promise.all([
        supabase.from('channels').select('id, type, name, is_active').eq('merchant_id', merchantId),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
      ]);
      if (!active) return;
      setChannels((channelRes.data as Channel[]) ?? []);
      setStats({ products: productRes.count ?? 0, orders: orderRes.count ?? 0, conversations: conversationRes.count ?? 0 });
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [merchant?.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);

  const activeChannels = useMemo(() => channels.filter((channel) => channel.is_active !== false), [channels]);

  function replyFor(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes('workflow') || lower.includes('فيسبوك') || lower.includes('facebook') || lower.includes('رسائل')) {
      setWorkflow({ name: 'إشعار رسائل Facebook', steps: ['استقبال رسالة جديدة على Facebook', 'التحقق من أنها محادثة واردة', 'إرسال تنبيه إلى البريد الإلكتروني', 'تسجيل العملية في سجل النشاط'] });
      return 'فهمت عليك. جهّزت workflow يراقب رسائل Facebook ويرسل تنبيهاً فورياً إلى البريد الإلكتروني. راجع المعاينة على اليمين، وبكبسة واحدة بنفعّله.';
    }
    if (lower.includes('طلب') || lower.includes('orders')) return `لقيت ${stats.orders} طلب ضمن حسابك. فيني أفلترهم حسب الحالة، أعدّل بياناتهم، أو أرسل تحديث للعميل. احكيلي شو الإجراء المطلوب بالضبط.`;
    if (lower.includes('منتج') || lower.includes('مخزون') || lower.includes('product')) return `قاعدة المنتجات جاهزة وفيها ${stats.products} منتج. فيني أعدّل السعر والمخزون، أضيف منتج، أو أطلعلك المنتجات التي تحتاج إعادة تزويد.`;
    if ((lower.includes('كل يوم') || lower.includes('يومياً') || lower.includes('يوميا')) && (lower.includes('الساعة') || lower.includes('ساعة')) && (lower.includes('تقرير') || lower.includes('ابعت') || lower.includes('أرسل'))) {
      const whatsapp = activeChannels.find((channel) => channel.type === 'whatsapp');
      const phone = trimmedPhone(text);
      const hourMatch = text.match(/(?:الساعة|ساعة)\s*(\d{1,2})/);
      const hour = Number(hourMatch?.[1] ?? 6);
      if (whatsapp && phone && hour >= 0 && hour <= 23) {
        setPendingSchedule({ channelId: whatsapp.id, recipient: phone, hour, instruction: text });
        return `فهمت. جهّزت جدولة يومية الساعة ${hour}:00 لإرسال التقرير إلى ${phone} عبر WhatsApp. راجعها على اليمين واضغط تأكيد الحفظ.`;
      }
      return 'لإنشاء الجدولة، اذكر الساعة ورقم WhatsApp، وتأكد أن قناة WhatsApp مربوطة.';
    }
    if (lower.includes('ابعت') || lower.includes('أرسل') || lower.includes('ارسلي') || lower.includes('رسالة')) {
      const whatsapp = activeChannels.find((channel) => channel.type === 'whatsapp');
      const phone = trimmedPhone(text);
      if (whatsapp && phone) {
        const report = `تقرير المتجر اليومي\nالمنتجات: ${stats.products}\nالطلبات: ${stats.orders}\nالمحادثات: ${stats.conversations}`;
        setPendingSend({ channel: whatsapp, to: phone, text: report });
        return `جهّزت الرسالة على حساب WhatsApp المربوط للرقم ${phone}. راجع النص واضغط تأكيد الإرسال حتى أنفّذ العملية.`;
      }
      return 'حدّد رقم WhatsApp بوضوح، وتأكد أن قناة WhatsApp مربوطة ومتّصلة قبل الإرسال.';
    }
    if (lower.includes('قناة') || lower.includes('channel') || lower.includes('واتساب')) return `حالياً عندك ${activeChannels.length} قناة نشطة. فيني أفعّل قواعد على أي قناة مربوطة، لكن إرسال رسائل خارجية سيطلب تأكيدك قبل التنفيذ.`;
    return 'تمام. فهمت طلبك وسأتعامل معه كإجراء على حساب متجرك. أعطيني تفاصيل أكثر مثل القناة، العميل، أو رقم الطلب حتى أنفّذه بدقة.';
  }

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages((current) => [...current, { id: Date.now(), role: 'merchant', text: trimmed, time: now() }]);
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: replyFor(trimmed), time: now(), action: trimmed.includes('workflow') || trimmed.includes('فيسبوك') ? 'workflow' : undefined }]);
    setSending(false);
  }

  async function confirmSchedule() {
    if (!merchant?.id || !pendingSchedule) return;
    const cronExpression = `0 ${pendingSchedule.hour} * * *`;
    const { error } = await supabase.from('ai_agent_schedules').insert({ merchant_id: merchant.id, channel_id: pendingSchedule.channelId, name: 'تقرير يومي عبر WhatsApp', instruction: pendingSchedule.instruction, cron_expression: cronExpression, recipient: pendingSchedule.recipient, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Beirut', next_run_at: nextRunAt(pendingSchedule.hour), is_active: true });
    if (error) {
      setSendError(error.message);
      return;
    }
    setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text: `تم حفظ الجدولة اليومية الساعة ${pendingSchedule.hour}:00 للرقم ${pendingSchedule.recipient}. يلزم تشغيل عامل الجدولة الخلفي حتى يبدأ الإرسال التلقائي.`, time: now() }]);
    setPendingSchedule(null);
  }

  async function confirmSend() {
    if (!pendingSend) return;
    setSendError(null);
    try {
      await sendAgentMessage({ channel: pendingSend.channel, recipient: pendingSend.to, text: pendingSend.text });
      setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text: `تم إرسال الرسالة بنجاح إلى ${pendingSend.to} عبر ${channelMeta[pendingSend.channel.type]?.label ?? pendingSend.channel.type}.`, time: now() }]);
      setPendingSend(null);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'تعذّر إرسال الرسالة.');
    }
  }

  async function activateWorkflow() {
    if (!merchant?.id || !workflow) return;
    const { error } = await supabase.from('workflows').insert({ merchant_id: merchant.id, name: workflow.name, description: 'تم إنشاؤه بواسطة AI Agent', steps: workflow.steps.map((label) => ({ label })), is_active: true });
    if (!error) {
      setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text: 'تم تفعيل الـ workflow بنجاح. رح أراقب القناة وأنفّذ الإجراء تلقائياً عند تحقق الشرط.', time: now() }]);
      setWorkflow(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <PageHeader title="AI Agent" description="وكيل ذكي يفهم طلباتك وينفّذها عبر كل عمليات متجرك" actions={<div className="flex items-center gap-2"><Badge color="green"><span className="h-2 w-2 rounded-full bg-green-500" /> متصل وجاهز</Badge><button className="btn-secondary btn-sm"><HelpCircle size={15} /> كيف يعمل؟</button></div>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { icon: Radio, label: 'القنوات النشطة', value: activeChannels.length, hint: 'من كل القنوات' },
          { icon: MessageCircle, label: 'المحادثات', value: stats.conversations, hint: 'محادثة في حسابك' },
          { icon: ShoppingCart, label: 'الطلبات', value: stats.orders, hint: 'طلب قابل للإدارة' },
          { icon: Package, label: 'المنتجات', value: stats.products, hint: 'منتج في الكتالوج' },
        ] as Array<{ icon: typeof Radio; label: string; value: number; hint: string }>).map(({ icon: Icon, label, value, hint }, index) => {
          const StatIcon = Icon as typeof Radio;
          return <div key={String(label)} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm"><div className="flex items-center justify-between"><div className={`h-9 w-9 rounded-xl flex items-center justify-center ${['bg-sky-50 text-sky-600','bg-violet-50 text-violet-600','bg-emerald-50 text-emerald-600','bg-amber-50 text-amber-600'][index]}`}><StatIcon size={18} /></div><span className="text-2xl font-extrabold text-slate-900">{loading ? '—' : value}</span></div><p className="mt-3 text-sm font-bold text-slate-700">{label}</p><p className="text-xs text-slate-400 mt-0.5">{hint}</p></div>;
        })}
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[650px]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20"><Bot className="text-white" size={23} /></div><div><h2 className="font-extrabold text-slate-900">محادثة مع وكيل المتجر</h2><p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> يفهم اللغة الطبيعية وينفّذ بأمان</p></div></div><button className="p-2 rounded-xl text-slate-400 hover:bg-slate-50"><MoreHorizontal size={20} /></button></div>
          <div ref={scrollRef} className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[520px] bg-[radial-gradient(#e2e8f0_0.7px,transparent_0.7px)] [background-size:18px_18px]">
            {messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'merchant' ? 'flex-row-reverse' : ''}`}><div className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${message.role === 'assistant' ? 'bg-violet-100 text-violet-600' : 'bg-sky-100 text-sky-600'}`}>{message.role === 'assistant' ? <Sparkles size={15} /> : <span className="text-xs font-extrabold">أنت</span>}</div><div className={`max-w-[82%] ${message.role === 'merchant' ? 'items-end' : 'items-start'} flex flex-col`}><div className={`rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === 'assistant' ? 'bg-white border border-slate-200 text-slate-700 rounded-tr-md' : 'bg-slate-900 text-white rounded-tl-md'}`}>{message.text}</div><span className="text-[11px] text-slate-400 mt-1 px-1">{message.time}</span></div></div>)}
            {sending && <div className="flex items-center gap-2 text-xs text-slate-400"><div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600"><Sparkles size={15} /></div><span className="animate-pulse">الوكيل يحلّل طلبك...</span></div>}
          </div>
          <div className="p-4 border-t border-slate-100"><div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 transition"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={2} className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400" placeholder="اكتب طلبك للوكيل... مثلاً: فعّل workflow عند وصول رسالة على Facebook" /><button onClick={() => sendMessage()} disabled={!input.trim() || sending} className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition"><ArrowUp size={18} /></button></div><div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400"><Command size={13} /> اضغط Enter للإرسال <span className="mx-1">•</span> Shift + Enter لسطر جديد <span className="mr-auto">كل إجراء حساس يحتاج تأكيدك</span></div></div>
        </section>
        <aside className="space-y-4">
          {pendingSchedule && <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden"><div className="p-4 bg-sky-50 border-b border-sky-100"><div className="flex items-center gap-2 text-sky-700"><Clock3 size={18} /><h3 className="font-extrabold">تأكيد الجدولة اليومية</h3></div><p className="text-xs text-sky-700/80 mt-1">سيتم حفظ الأمر على قناة WhatsApp المربوطة</p></div><div className="p-4"><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block mb-1">الوقت</span><strong className="text-slate-800">يومياً، {pendingSchedule.hour}:00</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block mb-1">الرقم</span><strong dir="ltr" className="text-slate-800">{pendingSchedule.recipient}</strong></div></div><p className="text-[11px] leading-5 text-slate-500 mt-3">{pendingSchedule.instruction}</p>{sendError && <p className="text-xs text-red-600 mt-2">{sendError}</p>}<div className="flex gap-2 mt-4"><button onClick={() => setPendingSchedule(null)} className="btn-secondary flex-1">إلغاء</button><button onClick={confirmSchedule} className="btn-primary flex-1"><Check size={15} /> حفظ الجدولة</button></div></div></div>}
          {pendingSend && <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden"><div className="p-4 bg-amber-50 border-b border-amber-100"><div className="flex items-center gap-2 text-amber-700"><Send size={18} /><h3 className="font-extrabold">تأكيد إرسال WhatsApp</h3></div><p className="text-xs text-amber-700/80 mt-1">لن يتم الإرسال إلا بعد موافقتك</p></div><div className="p-4"><p className="text-xs text-slate-500 mb-2">إلى: <strong dir="ltr" className="text-slate-800">{pendingSend.to}</strong></p><div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs leading-6 text-slate-600 whitespace-pre-line">{pendingSend.text}</div>{sendError && <p className="text-xs text-red-600 mt-2">{sendError}</p>}<div className="flex gap-2 mt-4"><button onClick={() => setPendingSend(null)} className="btn-secondary flex-1">إلغاء</button><button onClick={confirmSend} className="btn-primary flex-1"><Send size={15} /> تأكيد الإرسال</button></div></div></div>}
          {workflow && <div className="bg-white rounded-3xl border border-violet-200 shadow-sm overflow-hidden"><div className="p-4 bg-violet-50 border-b border-violet-100"><div className="flex items-center gap-2 text-violet-700"><Workflow size={18} /><h3 className="font-extrabold">معاينة الـ workflow</h3></div><p className="text-xs text-violet-600/80 mt-1">راجع الخطوات قبل التفعيل</p></div><div className="p-4"><h4 className="font-bold text-slate-800 text-sm mb-3">{workflow.name}</h4><div className="space-y-2">{workflow.steps.map((step, index) => <div key={step} className="flex items-start gap-2"><div className="h-5 w-5 shrink-0 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center">{index + 1}</div><p className="text-xs leading-5 text-slate-600">{step}</p></div>)}</div><button onClick={activateWorkflow} className="btn-primary w-full mt-4"><Check size={16} /> تفعيل workflow</button></div></div>}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5"><div className="flex items-center justify-between mb-4"><h3 className="font-extrabold text-slate-900">جرّب أن تطلب</h3><Sparkles size={18} className="text-violet-500" /></div><div className="space-y-2">{suggestions.map((suggestion) => { const SuggestionIcon = suggestion.icon; return <button key={suggestion.title} onClick={() => sendMessage(suggestion.text)} className="w-full text-right p-3 rounded-2xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition group"><div className="flex items-start gap-3"><div className="h-8 w-8 rounded-lg bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-500 group-hover:text-violet-600"><SuggestionIcon size={15} /></div><div><p className="text-xs font-bold text-slate-700">{suggestion.title}</p><p className="text-[11px] leading-5 text-slate-500 mt-0.5">{suggestion.text}</p></div><ChevronLeft size={14} className="mr-auto mt-1 text-slate-300 group-hover:text-violet-500" /></div></button>; })}</div></div>
          <div className="bg-slate-900 rounded-3xl p-5 text-white overflow-hidden relative"><div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" /><div className="relative"><div className="flex items-center gap-2 mb-3"><div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><Radio size={16} className="text-violet-300" /></div><h3 className="font-bold text-sm">القنوات المتصلة</h3></div>{loading ? <Spinner size="sm" className="text-violet-300" /> : activeChannels.length === 0 ? <p className="text-xs text-slate-400">لم يتم ربط قنوات بعد.</p> : <div className="space-y-2">{activeChannels.slice(0, 4).map((channel) => { const meta = channelMeta[channel.type] ?? { label: channel.type, icon: Radio, color: 'text-slate-600 bg-slate-100' }; const ChannelIcon = meta.icon; return <div key={channel.id} className="flex items-center gap-2.5 text-xs"><div className={`h-7 w-7 rounded-lg flex items-center justify-center ${meta.color}`}><ChannelIcon size={14} /></div><span className="text-slate-200">{channel.name || meta.label}</span><span className="mr-auto h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>; })}</div>}<a href="/app/connections" className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-white mt-4">إدارة القنوات <ChevronLeft size={13} /></a></div></div>
        </aside>
      </div>
    </div>
  );
}
