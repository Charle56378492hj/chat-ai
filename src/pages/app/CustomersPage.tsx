import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantData } from '../../lib/hooks';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, timeAgo } from '../../lib/format';
import { Search, Plus, Users, Download, Star, Mail, ShoppingCart, MoreVertical } from 'lucide-react';

export function CustomersPage() {
  const { customers, orders, loading } = useMerchantData();
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="العملاء"
        description={`${customers.length} عميل`}
        actions={
          <>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>
            <button className="btn-primary btn-sm"><Plus size={16} /> إضافة عميل</button>
          </>
        }
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input className="input pr-10" placeholder="بحث بالاسم أو رقم الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users size={28} />} title="لا يوجد عملاء" description="سيظهر عملاؤك هنا عند بدء المحادثات." action={<button className="btn-primary btn-sm"><Plus size={16} /> إضافة عميل</button>} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="p-4 text-sm font-bold text-slate-600">العميل</th>
                <th className="p-4 text-sm font-bold text-slate-600">الهاتف</th>
                <th className="p-4 text-sm font-bold text-slate-600">المدينة</th>
                <th className="p-4 text-sm font-bold text-slate-600">القناة</th>
                <th className="p-4 text-sm font-bold text-slate-600">الطلبات</th>
                <th className="p-4 text-sm font-bold text-slate-600">المشتريات</th>
                <th className="p-4 text-sm font-bold text-slate-600">آخر تواصل</th>
                <th className="p-4 text-sm font-bold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">{c.name?.charAt(0) ?? '؟'}</div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                          {c.name ?? 'عميل'}
                          {c.vip && <Star size={12} className="text-amber-500 fill-amber-400" />}
                        </div>
                        {c.tags.length > 0 && <div className="flex gap-1 mt-0.5">{c.tags.slice(0, 2).map((t) => <Badge key={t} color="sky">{t}</Badge>)}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">{c.phone ?? '—'}</td>
                  <td className="p-4 text-sm text-slate-600">{c.city ?? '—'}</td>
                  <td className="p-4"><Badge color="gray">{c.channel ?? '—'}</Badge></td>
                  <td className="p-4 text-sm font-semibold text-slate-700">{c.total_orders}</td>
                  <td className="p-4 text-sm font-semibold text-slate-700">{formatCurrency(Number(c.total_spent))}</td>
                  <td className="p-4 text-sm text-slate-500">{timeAgo(c.last_contact)}</td>
                  <td className="p-4">
                    <Link to={`/app/customers/${c.id}`} className="text-sky-600 hover:text-sky-700 text-sm font-semibold">عرض</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
