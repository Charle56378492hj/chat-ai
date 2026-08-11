import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { ORDER_STATUSES } from '../../lib/constants';
import {
  Plus, Search, Download, ShoppingCart, Printer, Send, Truck, X,
  Check, Package, Edit, MoreVertical, FileText,
} from 'lucide-react';
import type { Order } from '../../lib/types';

export function OrdersPage() {
  const { orders, customers, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Order | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    const matchesSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.phone?.includes(search);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function changeStatus(orderId: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setMenuOpen(null);
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="الطلبات"
        description={`${orders.length} طلب`}
        actions={
          <>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>
            <Link to="/app/orders/new" className="btn-primary btn-sm"><Plus size={16} /> طلب جديد</Link>
          </>
        }
      />

      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-3 text-slate-400" />
            <input className="input pr-10" placeholder="بحث برقم الطلب أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">كل الحالات</option>
            {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ShoppingCart size={28} />} title="لا توجد طلبات" description="ستظهر طلبات عملائك هنا." action={<Link to="/app/orders/new" className="btn-primary btn-sm"><Plus size={16} /> طلب جديد</Link>} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="p-4 text-sm font-bold text-slate-600">رقم الطلب</th>
                <th className="p-4 text-sm font-bold text-slate-600">العميل</th>
                <th className="p-4 text-sm font-bold text-slate-600">المدينة</th>
                <th className="p-4 text-sm font-bold text-slate-600">الهاتف</th>
                <th className="p-4 text-sm font-bold text-slate-600">الإجمالي</th>
                <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                <th className="p-4 text-sm font-bold text-slate-600">التاريخ</th>
                <th className="p-4 text-sm font-bold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const customer = customers.find((c) => c.id === o.customer_id);
                const status = ORDER_STATUSES.find((s) => s.value === o.status);
                return (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4 text-sm font-bold text-slate-900">{o.order_number ?? `#${o.id.slice(0, 8)}`}</td>
                    <td className="p-4 text-sm text-slate-700">{customer?.name ?? '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{o.city ?? '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{o.phone ?? '—'}</td>
                    <td className="p-4 text-sm font-bold text-sky-600">{formatCurrency(Number(o.total), merchant?.currency)}</td>
                    <td className="p-4">{status && <Badge color={status.color}>{status.label}</Badge>}</td>
                    <td className="p-4 text-sm text-slate-500">{formatDateTime(o.created_at)}</td>
                    <td className="p-4 relative">
                      <button onClick={() => setMenuOpen(menuOpen === o.id ? null : o.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><MoreVertical size={16} /></button>
                      {menuOpen === o.id && (
                        <div className="absolute left-4 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 w-44">
                          <button onClick={() => changeStatus(o.id, 'confirmed')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Check size={14} /> تأكيد</button>
                          <button onClick={() => changeStatus(o.id, 'preparing')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Package size={14} /> تجهيز</button>
                          <button onClick={() => changeStatus(o.id, 'shipped')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Truck size={14} /> شحن</button>
                          <button onClick={() => changeStatus(o.id, 'delivered')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Check size={14} /> تسليم</button>
                          <button onClick={() => changeStatus(o.id, 'cancelled')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><X size={14} /> إلغاء</button>
                          <hr className="my-1 border-slate-100" />
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Printer size={14} /> طباعة</button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Send size={14} /> إرسال للزبون</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
