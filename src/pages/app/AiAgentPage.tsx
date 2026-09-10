import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useMerchantData } from '../../lib/hooks';
import {
  sendAgentChatMessage, listAgentConversations, loadAgentMessages, listAgentActivity,
  listAgentSchedules, setAgentScheduleActive, deleteAgentSchedule,
} from '../../lib/aiAgentChat';
import { Badge, PageHeader, Spinner, EmptyState } from '../../components/ui';
import {
  ArrowUp, Bot, ChevronLeft, Clock3, Command, MessageCircle, Package,
  Radio, Send, ShoppingCart, Sparkles, TrendingUp, BarChart3, Plus,
  History, Activity, CheckCircle2, XCircle, Trash2, Pause, Play, MessageSquarePlus,
} from 'lucide-react';
import type { AiAgentConversation, AiAgentMessage, AiAgentAction, AiAgentSchedule } from '../../lib/types';

type Channel = { id: string; type: string; name?: string; is_active?: boolean };

type ChatBubble = {
  id: string;
  role: 'assistant' | 'merchant' | 'tool';
  text: string;
  time: string;
  toolName?: string;
  toolStatus?: 'completed' | 'failed';
};

const channelMeta: Record<string, { label: string; icon: typeof MessageCircle; color: string }> = {
  whatsapp: { label: 'واتساب', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  telegram: { label: 'تلغرام', icon: Send, color: 'text-sky-600 bg-sky-50' },
};

const suggestions = [
  { icon: ShoppingCart, title: 'الطلبات الجديدة', text: 'اعرض لي الطلبات النشطة الآن' },
  { icon: Package, title: 'نفاد المخزون', text: 'أيّ منتجات قليلة المخزون؟' },
  { icon: BarChart3, title: 'ملخص الأداء', text: 'شو أكثر منتج انباع هالأسبوع؟' },
  { icon: Radio, title: 'القنوات', text: 'شو القنوات المتصلة حالياً؟' },
];

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function toBubbles(messages: AiAgentMessage[]): ChatBubble[] {
  const bubbles: ChatBubble[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      bubbles.push({ id: m.id, role: 'merchant', text: m.content ?? '', time: timeLabel(m.created_at) });
    } else if (m.role === 'assistant' && m.content) {
      bubbles.push({ id: m.id, role: 'assistant', text: m.content, time: timeLabel(m.created_at) });
    } else if (m.role === 'tool') {
      const result = m.tool_result as { error?: string } | null;
      bubbles.push({
        id: m.id, role: 'tool', text: m.tool_name ?? 'tool', time: timeLabel(m.created_at),
        toolName: m.tool_name ?? undefined, toolStatus: result?.error ? 'failed' : 'completed',
      });
    }
  }
  return bubbles;
}

const WELCOME: ChatBubble = {
  id: 'welcome',
  role: 'assistant',
  text: `أهلاً وسهلاً! 👋 أنا AI Command Center — أقدر أساعدك بـ:
✅ عرض الطلبات والمنتجات والقنوات والعملاء من بياناتك الحقيقية
✅ تحديث حالة طلب أو منتج
✅ إرسال رسائل فورية عبر واتساب/تيليغرام
✅ جدولة تقارير يومية متكررة
✅ تحليل المبيعات وأكثر المنتجات طلباً

كيف أساعدك اليوم؟ 😊`,
  time: '',
};

export function AiAgentPage() {
  const { merchant } = useAuth();
  const { channels: rawChannels = [] } = useMerchantData();
  const channels = rawChannels as Channel[];

  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'activity' | 'schedules'>('chat');
  const [conversations, setConversations] = useState<AiAgentConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([WELCOME]);
  const [activity, setActivity] = useState<AiAgentAction[]>([]);
  const [schedules, setSchedules] = useState<AiAgentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const merchantId = merchant?.id;

  async function refreshSidebarData() {
    if (!merchantId) return;
    const [convs, actions, scheds] = await Promise.all([
      listAgentConversations(merchantId).catch(() => []),
      listAgentActivity(merchantId).catch(() => []),
      listAgentSchedules(merchantId).catch(() => []),
    ]);
    setConversations(convs);
    setActivity(actions);
    setSchedules(scheds);
  }

  useEffect(() => {
    if (!merchantId) return;
    refreshSidebarData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [bubbles]);

  async function openConversation(id: string) {
    setActiveTab('chat');
    setConversationId(id);
    setError(null);
    try {
      const msgs = await loadAgentMessages(id);
      setBubbles(msgs.length ? toBubbles(msgs) : [WELCOME]);
    } catch {
      setError('تعذّر تحميل هذه المحادثة.');
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setBubbles([WELCOME]);
    setError(null);
    setActiveTab('chat');
  }

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    setError(null);
    setBubbles((prev) => [...prev, { id: `local-${Date.now()}`, role: 'merchant', text, time: timeLabel(new Date().toISOString()) }]);

    try {
      const result = await sendAgentChatMessage(text, conversationId);
      setConversationId(result.conversation_id);

      const toolBubbles: ChatBubble[] = result.actions.map((a, i) => ({
        id: `tool-${Date.now()}-${i}`,
        role: 'tool',
        text: a.tool,
        time: timeLabel(new Date().toISOString()),
        toolName: a.tool,
        toolStatus: a.status,
      }));
      setBubbles((prev) => [
        ...prev,
        ...toolBubbles,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: result.message, time: timeLabel(new Date().toISOString()) },
      ]);
      refreshSidebarData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع.';
      setError(message);
      setBubbles((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', text: `❌ ${message}`, time: timeLabel(new Date().toISOString()) }]);
    } finally {
      setSending(false);
    }
  }

  async function toggleSchedule(schedule: AiAgentSchedule) {
    try {
      await setAgentScheduleActive(schedule.id, !schedule.is_active);
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, is_active: !s.is_active } : s)));
    } catch { /* تجاهل بصمت، القيمة السابقة تبقى معروضة */ }
  }

  async function removeSchedule(id: string) {
    try {
      await deleteAgentSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch { /* noop */ }
  }

  const activeChannels = channels.filter((c) => c.is_active);
  const activeSchedulesCount = schedules.filter((s) => s.is_active).length;

  const tabs: Array<{ key: typeof activeTab; label: string; icon: typeof Bot; count?: number }> = [
    { key: 'chat', label: 'المحادثة', icon: Bot },
    { key: 'history', label: 'السجل', icon: History, count: conversations.length || undefined },
    { key: 'activity', label: 'سجل العمليات', icon: Activity, count: activity.length || undefined },
    { key: 'schedules', label: 'الجدولة', icon: Clock3, count: activeSchedulesCount || undefined },
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      <PageHeader
        title="AI Command Center"
        description="مدير عمليات ذكي يفهم أوامرك الطبيعية وينفذها على بياناتك الحقيقية"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={startNewConversation} className="btn-secondary text-xs">
              <MessageSquarePlus size={14} /> محادثة جديدة
            </button>
            <a href="/app/ai-studio" className="btn-secondary text-xs">إعدادات الذكاء الاصطناعي</a>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { icon: Radio, label: 'القنوات النشطة', value: activeChannels.length, hint: `من أصل ${channels.length}` },
          { icon: History, label: 'المحادثات المحفوظة', value: conversations.length, hint: 'مع الوكيل' },
          { icon: Activity, label: 'عمليات منفذة', value: activity.length, hint: 'بسجل النشاط' },
          { icon: TrendingUp, label: 'المهام المجدولة', value: activeSchedulesCount, hint: 'جدولة فعّالة' },
        ]).map(({ icon: Icon, label, value, hint }, index) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${['bg-sky-50 text-sky-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600'][index]}`}>
                <Icon size={18} />
              </div>
              <span className="text-2xl font-extrabold text-slate-900">{loading ? '—' : value}</span>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200 p-1.5 w-fit">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Icon size={14} /> {label}
            {typeof count === 'number' && (
              <span className={`text-[10px] rounded-full px-1.5 ${activeTab === key ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* Chat Section */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Bot className="text-white" size={23} />
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900">محادثة ذكية</h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    ينفّذ أدوات حقيقية على بياناتك — لا بيانات وهمية
                  </p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[580px] bg-[radial-gradient(#e2e8f0_0.7px,transparent_0.7px)] [background-size:18px_18px]">
              {bubbles.map((message) => {
                if (message.role === 'tool') {
                  const ok = message.toolStatus !== 'failed';
                  return (
                    <div key={message.id} className="flex items-center gap-2 pr-11 text-[11px]">
                      {ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-rose-500" />}
                      <span className={ok ? 'text-slate-400' : 'text-rose-500'}>
                        {ok ? 'تم تنفيذ' : 'فشل تنفيذ'} <code className="font-mono">{message.toolName}</code>
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'merchant' ? 'flex-row-reverse' : ''}`}>
                    <div className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${message.role === 'assistant' ? 'bg-violet-100 text-violet-600' : 'bg-sky-100 text-sky-600'}`}>
                      {message.role === 'assistant' ? <Sparkles size={15} /> : <span className="text-xs font-extrabold">أنت</span>}
                    </div>
                    <div className={`max-w-[82%] ${message.role === 'merchant' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${message.role === 'assistant' ? 'bg-white border border-slate-200 text-slate-700 rounded-tr-md' : 'bg-slate-900 text-white rounded-tl-md'}`}>
                        {message.text}
                      </div>
                      {message.time && <span className="text-[11px] text-slate-400 mt-1 px-1">{message.time}</span>}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                    <Sparkles size={15} />
                  </div>
                  <span className="animate-pulse">الوكيل يعالج طلبك...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100">
              {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 transition">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  rows={2}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
                  placeholder="اطلب من الوكيل ما تريد... مثلاً: اعرض الطلبات الجديدة، أو أرسل رسالة واتس"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400">
                <Command size={13} /> Enter للإرسال <span className="mx-1">•</span> Shift + Enter لسطر جديد
              </div>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-slate-900">اقتراحات سريعة</h3>
                <Sparkles size={18} className="text-violet-500" />
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => {
                  const SuggestionIcon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.title}
                      onClick={() => sendMessage(suggestion.text)}
                      className="w-full text-right p-3 rounded-2xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-500 group-hover:text-violet-600 shrink-0">
                          <SuggestionIcon size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{suggestion.title}</p>
                          <p className="text-[11px] leading-5 text-slate-500 mt-0.5">{suggestion.text}</p>
                        </div>
                        <ChevronLeft size={14} className="mr-auto mt-1 text-slate-300 group-hover:text-violet-500" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-5 text-white overflow-hidden relative">
              <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Radio size={16} className="text-violet-300" />
                  </div>
                  <h3 className="font-bold text-sm">القنوات المتصلة</h3>
                </div>
                {loading ? (
                  <Spinner size="sm" className="text-violet-300" />
                ) : activeChannels.length === 0 ? (
                  <p className="text-xs text-slate-400">لم يتم ربط قنوات بعد</p>
                ) : (
                  <div className="space-y-2">
                    {activeChannels.slice(0, 5).map((channel) => {
                      const meta = channelMeta[channel.type] ?? { label: channel.type, icon: Radio, color: 'text-slate-600 bg-slate-100' };
                      const ChannelIcon = meta.icon;
                      return (
                        <div key={channel.id} className="flex items-center gap-2.5 text-xs">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                            <ChannelIcon size={14} />
                          </div>
                          <span className="text-slate-200">{channel.name || meta.label}</span>
                          <span className="mr-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <a href="/app/connections" className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-white mt-4">
                  إدارة جميع القنوات <ChevronLeft size={13} />
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
          {conversations.length === 0 ? (
            <EmptyState icon={<History size={28} />} title="لا توجد محادثات بعد" description="ابدأ محادثة جديدة مع الوكيل من تبويب المحادثة." />
          ) : (
            <div className="divide-y divide-slate-100">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`w-full text-right p-4 flex items-center gap-3 hover:bg-slate-50 transition ${conversationId === c.id ? 'bg-violet-50/60' : ''}`}
                >
                  <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{c.title || 'محادثة بدون عنوان'}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message || '—'}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{c.last_message_at ? timeLabel(c.last_message_at) : ''}</span>
                  <ChevronLeft size={14} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
          {activity.length === 0 ? (
            <EmptyState icon={<Activity size={28} />} title="لا توجد عمليات منفذة بعد" description="كل أداة ينفذها الوكيل (عرض، تحديث، إرسال، جدولة) ستظهر هنا مع حالتها الحقيقية." />
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((a) => (
                <div key={a.id} className="p-4 flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {a.status === 'completed' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold text-slate-800">{a.action_type}</code>
                      <Badge color={a.status === 'completed' ? 'green' : 'red'}>{a.status === 'completed' ? 'نجح' : 'فشل'}</Badge>
                    </div>
                    {a.error_message && <p className="text-xs text-rose-500 mt-1">{a.error_message}</p>}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{timeLabel(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
          {schedules.length === 0 ? (
            <EmptyState
              icon={<Clock3 size={28} />}
              title="لا توجد جدولات بعد"
              description={'اطلب من الوكيل بالمحادثة مثلاً: "بدي تقرير كل يوم الساعة 9 صباحاً عبر واتساب لرقم 09xxxxxxxx".'}
              action={<button onClick={() => setActiveTab('chat')} className="btn-primary text-xs"><Plus size={14} /> اذهب للمحادثة</button>}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {schedules.map((s) => (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${s.is_active ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Clock3 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{s.instruction}</p>
                    {s.last_error && <p className="text-[11px] text-rose-500 mt-1">آخر خطأ: {s.last_error}</p>}
                  </div>
                  <Badge color={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'فعّالة' : 'متوقفة'}</Badge>
                  <button onClick={() => toggleSchedule(s)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title={s.is_active ? 'إيقاف' : 'تفعيل'}>
                    {s.is_active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button onClick={() => removeSchedule(s.id)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500" title="حذف">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
