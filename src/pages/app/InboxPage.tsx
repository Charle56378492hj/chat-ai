import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantData, fetchMessages, sendMessage } from '../../lib/hooks';
import { Badge, Spinner, EmptyState } from '../../components/ui';
import { timeAgo, formatDateTime, formatCurrency } from '../../lib/format';
import { CONVERSATION_STATUSES } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import type { Message } from '../../lib/types';
import {
  Bot, Send, Search, UserPlus, BellOff, Star, FileText,
  ShoppingCart, Mail, Zap, ZapOff, Plus, StickyNote, X,
  Check, Package, MessageSquare,
} from 'lucide-react';

export function InboxPage() {
  const { conversations, customers, channels, loading, reload } = useMerchantData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);
  const customer = selected ? customers.find((x) => x.id === selected.customer_id) : null;
  const channel = selected ? channels.find((c) => c.id === selected.channel_id) : null;

  useEffect(() => {
    if (selectedId) {
      setMsgLoading(true);
      fetchMessages(selectedId).then((msgs) => {
        setMessages(msgs);
        setMsgLoading(false);
      });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedId) return;
    const sub = supabase
      .channel(`messages:${selectedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [selectedId]);

  async function handleSend() {
    if (!input.trim() || !selectedId) return;
    const content = input;
    setInput('');
    await sendMessage(selectedId, content, 'agent', false);
    const msgs = await fetchMessages(selectedId);
    setMessages(msgs);
  }

  // ✅ FIXED: was window.location.reload() — now uses proper state update
  async function toggleAi() {
    if (!selected) return;
    await supabase
      .from('conversations')
      .update({ ai_enabled: !selected.ai_enabled })
      .eq('id', selected.id);
    reload();
  }

  // ✅ FIXED: was window.location.reload() — now uses proper state update
  async function changeStatus(status: string) {
    if (!selected) return;
    await supabase.from('conversations').update({ status }).eq('id', selected.id);
    reload();
  }

  async function markRead() {
    if (!selected) return;
    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', selected.id);
    reload();
  }

  const filteredConvs = conversations.filter((c) => {
    const cust = customers.find((x) => x.id === c.customer_id);
    const matchesSearch = !search || cust?.name?.toLowerCase().includes(search.toLowerCase()) || c.last_message?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      c.status === filter ||
      (filter === 'ai' && c.ai_enabled) ||
      (filter === 'unread' && c.unread_count > 0);
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">المحادثات</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm"><UserPlus size={16} /> تحويل</button>
          <button className="btn-primary btn-sm"><Plus size={16} /> رسالة جديدة</button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 card flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative mb-2">
              <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                className="input pr-9 py-2 text-sm"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {[
                { value: 'all', label: 'الكل' },
                { value: 'open', label: 'مفتوح' },
                { value: 'pending', label: 'انتظار' },
                { value: 'ai', label: 'AI' },
                { value: 'unread', label: 'غير مقروء' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${filter === f.value ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <EmptyState icon={<MessageSquare size={24} />} title="لا توجد محادثات" description="ستظهر محادثات عملائك هنا" />
            ) : (
              filteredConvs.map((c) => {
                const cust = customers.find((x) => x.id === c.customer_id);
                const ch = channels.find((x) => x.id === c.channel_id);
                const status = CONVERSATION_STATUSES.find((s) => s.value === c.status);
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedId(c.id); if (c.unread_count > 0) markRead(); }}
                    className={`w-full flex items-start gap-3 p-3 border-b border-slate-50 text-right transition-colors ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${isSelected ? 'bg-sky-500' : 'bg-gradient-to-br from-sky-400 to-blue-600'}`}>
                      {cust?.name?.charAt(0) ?? '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-slate-900 truncate">{cust?.name ?? 'عميل جديد'}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message ?? 'لا توجد رسائل'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {ch && <span className="text-xs text-slate-400">{ch.name}</span>}
                        {c.ai_enabled && <Badge color="indigo"><Bot size={9} /> AI</Badge>}
                        {status && <Badge color={status.color as 'green' | 'amber' | 'sky' | 'gray'}>{status.label}</Badge>}
                        {c.unread_count > 0 && <span className="h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">{c.unread_count}</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat area */}
        {selected ? (
          <div className="flex-1 card flex flex-col min-w-0">
            {/* Chat header */}
            <div className="border-b border-slate-100 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {customer?.name?.charAt(0) ?? '؟'}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{customer?.name ?? 'عميل جديد'}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {channel && <span>{channel.name}</span>}
                    {customer?.phone && <span>{customer.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleAi}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selected.ai_enabled ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {selected.ai_enabled ? <><Bot size={14} /> AI شغّال</> : <><ZapOff size={14} /> AI معطّل</>}
                </button>
                <select
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
                  value={selected.status}
                  onChange={(e) => changeStatus(e.target.value)}
                >
                  {CONVERSATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {msgLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageSquare size={32} className="mb-2" />
                  <p className="text-sm">لا توجد رسائل بعد</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isAgent = m.sender === 'agent' || m.sender === 'ai';
                  return (
                    <div key={m.id} className={`flex gap-2 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      {!isAgent && (
                        <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                          {customer?.name?.charAt(0) ?? 'ع'}
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        <div className={`rounded-2xl px-4 py-2.5 text-sm ${isAgent ? 'bg-sky-500 text-white rounded-tl-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm shadow-sm'}`}>
                          {m.content}
                        </div>
                        <div className="flex items-center gap-1 px-1">
                          <span className="text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                          {m.is_auto && <Badge color="indigo"><Bot size={9} /> تلقائي</Badge>}
                        </div>
                      </div>
                      {isAgent && (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.is_auto ? 'bg-indigo-500' : 'bg-sky-500'}`}>
                          {m.is_auto ? <Bot size={14} className="text-white" /> : <span className="text-white text-xs font-bold">أ</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-slate-100 p-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    className="input resize-none text-sm py-2 min-h-[40px] max-h-[120px]"
                    placeholder="اكتب ردًا..."
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="btn-primary btn-sm h-10 px-4"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button className="btn-ghost btn-sm text-xs"><FileText size={12} /> قالب</button>
                <button className="btn-ghost btn-sm text-xs"><ShoppingCart size={12} /> طلب</button>
                <button className="btn-ghost btn-sm text-xs"><StickyNote size={12} /> ملاحظة</button>
                <button className="btn-ghost btn-sm text-xs"><Package size={12} /> منتج</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 card flex items-center justify-center">
            <EmptyState icon={<MessageSquare size={32} />} title="اختر محادثة" description="اختر محادثة من القائمة للبدء" />
          </div>
        )}

        {/* Customer sidebar */}
        {selected && customer && (
          <div className="w-64 flex-shrink-0 card flex flex-col p-4 space-y-4 overflow-y-auto">
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
                {customer.name?.charAt(0) ?? '؟'}
              </div>
              <div className="font-bold text-slate-900 text-sm">{customer.name ?? 'عميل'}</div>
              <div className="text-xs text-slate-500">{customer.phone ?? '—'}</div>
              <div className="flex justify-center gap-1.5 mt-2">
                {customer.vip && <Badge color="amber">VIP</Badge>}
                {customer.total_orders > 0 && <Badge color="blue">{customer.total_orders} طلب</Badge>}
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-50"><span className="text-slate-500">المدينة</span><span className="font-semibold text-slate-700 text-xs">{customer.city ?? '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-50"><span className="text-slate-500">القناة</span><span className="font-semibold text-slate-700 text-xs">{customer.channel ?? '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-50"><span className="text-slate-500">آخر تواصل</span><span className="font-semibold text-slate-700 text-xs">{timeAgo(customer.last_contact)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">المشتريات</span><span className="font-semibold text-sky-600 text-xs">{formatCurrency(Number(customer.total_spent))}</span></div>
            </div>

            {customer.tags.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1.5">العلامات</div>
                <div className="flex flex-wrap gap-1">{customer.tags.map((t) => <Badge key={t} color="sky">{t}</Badge>)}</div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <Link to={`/app/customers/${customer.id}`} className="w-full btn-secondary btn-sm flex items-center justify-center gap-1.5">
                <Star size={13} /> عرض الملف
              </Link>
              <button className="w-full btn-secondary btn-sm"><Mail size={13} /> إرسال رسالة</button>
              <button className="w-full btn-secondary btn-sm"><ShoppingCart size={13} /> إنشاء طلب</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
