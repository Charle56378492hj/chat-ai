import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { PageHeader, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatNumber } from '../../lib/format';
import { ORDER_STATUSES } from '../../lib/constants';
import { BarChart3, TrendingUp, Download, Bot, Users, Clock, MessageSquare, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0EA5E9', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899'];

export function AnalyticsPage() {
  const { conversations, orders, products, customers, channels, loading } = useMerchantData();
  const { merchant } = useAuth();

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const totalSales = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0);
  const aiConvs = conversations.filter((c) => c.ai_enabled).length;
  const aiRate = conversations.length > 0 ? Math.round((aiConvs / conversations.length) * 100) : 0;

  // Last 7 days data
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const dayConvs = conversations.filter((c) => c.created_at && new Date(c.created_at) >= dayStart && new Date(c.created_at) <= dayEnd).length;
    const dayOrders = orders.filter((o) => o.created_at && new Date(o.created_at) >= dayStart && new Date(o.created_at) <= dayEnd).length;
    return { day: d.toLocaleDateString('ar-SA', { weekday: 'short' }), messages: dayConvs, orders: dayOrders };
  });

  const statusData = ORDER_STATUSES.map((s) => ({
    name: s.label,
    value: orders.filter((o) => o.status === s.value).length,
  })).filter((d) => d.value > 0);

  const channelData = channels.map((ch) => ({
    name: ch.name,
    messages: conversations.filter((c) => c.channel_id === ch.id).length,
  })).filter((d) => d.messages > 0);

  const topProducts = products
    .map((p) => ({ name: p.name, orders: orders.filter((o) => o.customer_id && customers.find((c) => c.id === o.customer_id)).length }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  const stats = [
    { label: 'إجمالي الرسائل', value: formatNumber(conversations.length), icon: MessageSquare, color: 'sky' },
    { label: 'معدل الإغلاق (AI)', value: `${aiRate}%`, icon: Bot, color: 'indigo' },
    { label: 'إجمالي المبيعات', value: formatCurrency(totalSales, merchant?.currency), icon: TrendingUp, color: 'green' },
    { label: 'متوسط وقت الرد', value: '1.2 ثانية', icon: Clock, color: 'amber' },
    { label: 'عملاء نشطون', value: formatNumber(customers.length), icon: Users, color: 'violet' },
    { label: 'طلبات مكتملة', value: formatNumber(orders.filter((o) => o.status === 'delivered').length), icon: ShoppingCart, color: 'emerald' },
  ];

  const colorMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600', indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="التحليلات"
        description="مؤشرات الأداء والإحصائيات"
        actions={
          <>
            <select className="input btn-sm w-auto">
              <option>آخر 7 أيام</option>
              <option>آخر 30 يوم</option>
              <option>هذا الشهر</option>
              <option>هذا العام</option>
            </select>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير PDF</button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[s.color]}`}><s.icon size={20} /></div>
            <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">الرسائل والطلبات (7 أيام)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
              <Legend />
              <Bar dataKey="messages" name="رسائل" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
              <Bar dataKey="orders" name="طلبات" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">توزيع حالات الطلبات</h3>
          {statusData.length === 0 ? (
            <EmptyState icon={<BarChart3 size={28} />} title="لا توجد بيانات" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">أداء القنوات</h3>
          {channelData.length === 0 ? (
            <EmptyState icon={<BarChart3 size={28} />} title="لا توجد بيانات" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" stroke="#94A3B8" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={12} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="messages" name="رسائل" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">أكثر المنتجات طلبًا</h3>
          {topProducts.length === 0 || topProducts[0].orders === 0 ? (
            <EmptyState icon={<BarChart3 size={28} />} title="لا توجد بيانات" />
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 text-sm font-bold">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                      <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${(p.orders / topProducts[0].orders) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{p.orders}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
