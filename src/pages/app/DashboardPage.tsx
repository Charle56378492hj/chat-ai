import { Link } from 'react-router-dom';
import { useMerchantData } from '../../lib/hooks';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatNumber, timeAgo } from '../../lib/format';
import { ORDER_STATUSES, CONVERSATION_STATUSES } from '../../lib/constants';
import {
  MessageSquare, ShoppingCart, Package, Users, Bot, TrendingUp, TrendingDown,
  AlertTriangle, Plus, Zap, Plug, FileText, ArrowLeft, Clock, CheckCircle2,
  Activity,
} from 'lucide-react';

export function DashboardPage() {
  const { conversations, orders, products, channels, customers, loading } = useMerchantData();

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayConvs = conversations.filter((c) => c.created_at && new Date(c.created_at) >= todayStart);
  const newOrders = orders.filter((o) => o.status === 'new' || o.status === 'pending_confirmation');
  const processingOrders = orders.filter((o) => ['confirmed', 'preparing', 'shipped'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'delivered');
  const humanHandoff = conversations.filter((c) => c.status === 'assigned');
  const aiClosed = conversations.length > 0 ? Math.round((conversations.filter((c) => c.ai_enabled).length / conversations.length) * 100) : 0;
  const lowStock = products.filter((p) => p.stock < 10);
  const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const errorChannels = channels.filter((c) => c.status === 'error' || c.status === 'disconnected');

  const stats = [
    { label: 'رسائل اليوم', value: formatNumber(todayConvs.length), icon: MessageSquare, color: 'sky', trend: '+12%' },
    { label: 'طلبات جديدة', value: formatNumber(newOrders.length), icon: ShoppingCart, color: 'blue', trend: '+8%' },
    { label: 'قيد المعالجة', value: formatNumber(processingOrders.length), icon: Package, color: 'amber', trend: '+3%' },
    { label: 'مكتملة', value: formatNumber(completedOrders.length), icon: CheckCircle2, color: 'green', trend: '+15%' },
    { label: 'محولة للبشر', value: formatNumber(humanHandoff.length), icon: Users, color: 'violet', trend: '-5%' },
    { label: 'إغلاق الذكاء', value: `${aiClosed}%`, icon: Bot, color: 'indigo', trend: '+4%' },
    { label: 'رضا العملاء', value: '94%', icon: TrendingUp, color: 'emerald', trend: '+2%' },
    { label: 'إجمالي المبيعات', value: formatCurrency(totalSales), icon: TrendingUp, color: 'sky', trend: '+22%' },
  ];

  const colorMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600', indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  const quickActions = [
    { label: 'رسالة جديدة', icon: MessageSquare, to: '/app/inbox' },
    { label: 'إضافة منتج', icon: Plus, to: '/app/products' },
    { label: 'إنشاء طلب', icon: ShoppingCart, to: '/app/orders/new' },
    { label: 'تدريب الذكاء', icon: Bot, to: '/app/ai-studio' },
    { label: 'ربط قناة', icon: Plug, to: '/app/connections' },
    { label: 'تصدير تقرير', icon: FileText, to: '/app/analytics' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء متجرك اليوم"
        actions={
          <>
            <Link to="/app/inbox" className="btn-secondary btn-sm"><MessageSquare size={16} /> فتح المحادثات</Link>
            <Link to="/app/orders/new" className="btn-primary btn-sm"><Plus size={16} /> طلب جديد</Link>
          </>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[s.color]}`}>
                <s.icon size={20} />
              </div>
              <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">
                <TrendingUp size={12} /> {s.trend}
              </span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Quick actions */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">إجراءات سريعة</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Link key={a.label} to={a.to} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-sky-200 transition-colors">
                <a.icon size={18} className="text-sky-500" /> {a.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> التنبيهات</h3>
          <div className="space-y-2">
            {lowStock.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Package size={16} /> {lowStock.length} منتج بمخزون منخفض
              </div>
            )}
            {errorChannels.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <Plug size={16} /> {errorChannels.length} قناة تحتاج إعادة ربط
              </div>
            )}
            {newOrders.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                <ShoppingCart size={16} /> {newOrders.length} طلب بانتظار التأكيد
              </div>
            )}
            {lowStock.length === 0 && errorChannels.length === 0 && newOrders.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={16} /> كل شيء على ما يرام
              </div>
            )}
          </div>
        </div>

        {/* Channel performance */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Activity size={18} className="text-sky-500" /> أداء القنوات</h3>
          {channels.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد قنوات مربوطة. <Link to="/app/connections" className="text-sky-600">اربط قناة</Link></p>
          ) : (
            <div className="space-y-3">
              {channels.slice(0, 5).map((ch) => {
                const count = conversations.filter((c) => c.channel_id === ch.id).length;
                return (
                  <div key={ch.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{ch.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge color={ch.status === 'connected' ? 'green' : 'gray'}>{ch.status === 'connected' ? 'متصل' : 'مفصول'}</Badge>
                      <span className="text-xs text-slate-500">{count} محادثة</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent conversations */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">آخر المحادثات</h3>
            <Link to="/app/inbox" className="text-sm text-sky-600 font-semibold flex items-center gap-1">عرض الكل <ArrowLeft size={14} /></Link>
          </div>
          {conversations.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} title="لا توجد محادثات" description="ستظهر محادثات عملائك هنا عند ربط القنوات." />
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 5).map((c) => {
                const customer = customers.find((x) => x.id === c.customer_id);
                const status = CONVERSATION_STATUSES.find((s) => s.value === c.status);
                return (
                  <Link key={c.id} to="/app/inbox" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                      {customer?.name?.charAt(0) ?? '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{customer?.name ?? 'عميل جديد'}</div>
                      <div className="text-xs text-slate-500 truncate">{c.last_message ?? 'لا توجد رسائل'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.ai_enabled && <Badge color="indigo"><Bot size={10} /> AI</Badge>}
                      {status && <Badge color={status.color}>{status.label}</Badge>}
                      <span className="text-xs text-slate-400">{timeAgo(c.last_message_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">آخر الطلبات</h3>
            <Link to="/app/orders" className="text-sm text-sky-600 font-semibold flex items-center gap-1">عرض الكل <ArrowLeft size={14} /></Link>
          </div>
          {orders.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={28} />} title="لا توجد طلبات" description="ستظهر طلبات عملائك هنا." />
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 5).map((o) => {
                const status = ORDER_STATUSES.find((s) => s.value === o.status);
                return (
                  <Link key={o.id} to="/app/orders" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <div className="h-9 w-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                      <ShoppingCart size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{o.order_number ?? `#${o.id.slice(0, 8)}`}</div>
                      <div className="text-xs text-slate-500">{o.city ?? '—'} • {formatCurrency(Number(o.total))}</div>
                    </div>
                    {status && <Badge color={status.color}>{status.label}</Badge>}
                    <span className="text-xs text-slate-400">{timeAgo(o.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
