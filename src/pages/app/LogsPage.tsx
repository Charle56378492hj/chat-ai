import { useState } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { Search, Download, ScrollText, Eye } from 'lucide-react';

export function LogsPage() {
  const { loading } = useMerchantData();
  const [search, setSearch] = useState('');

  // Simulated logs since audit_logs requires real actions
  const logs = [
    { id: '1', actor: 'أنت', action: 'تسجيل دخول', target: 'النظام', time: new Date().toISOString(), details: 'IP: 85.1.2.3' },
    { id: '2', actor: 'الذكاء', action: 'رد آلي', target: 'محادثة #1024', time: new Date(Date.now() - 3600000).toISOString(), details: 'رد على سؤال سعر' },
    { id: '3', actor: 'أنت', action: 'تعديل منتج', target: 'تيشيرت أحمر', time: new Date(Date.now() - 7200000).toISOString(), details: 'تغيير السعر 89→99' },
    { id: '4', actor: 'أنت', action: 'ربط قناة', target: 'واتساب', time: new Date(Date.now() - 86400000).toISOString(), details: 'ربط رقم +966...' },
    { id: '5', actor: 'موظف', action: 'تحويل محادثة', target: 'محادثة #1020', time: new Date(Date.now() - 172800000).toISOString(), details: 'تحويل لقسم الدعم' },
  ];

  const filtered = logs.filter((l) => !search || l.action.includes(search) || l.target.includes(search) || l.actor.includes(search));

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="السجلات"
        description="سجل تدقيق كامل لكل الإجراءات"
        actions={<button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>}
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input className="input pr-10" placeholder="بحث في السجلات..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<ScrollText size={28} />} title="لا توجد سجلات" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="p-4 text-sm font-bold text-slate-600">المنفّذ</th>
                <th className="p-4 text-sm font-bold text-slate-600">الإجراء</th>
                <th className="p-4 text-sm font-bold text-slate-600">الهدف</th>
                <th className="p-4 text-sm font-bold text-slate-600">التفاصيل</th>
                <th className="p-4 text-sm font-bold text-slate-600">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 text-sm font-semibold text-slate-700">{l.actor}</td>
                  <td className="p-4"><Badge color="sky">{l.action}</Badge></td>
                  <td className="p-4 text-sm text-slate-600">{l.target}</td>
                  <td className="p-4 text-sm text-slate-500">{l.details}</td>
                  <td className="p-4 text-sm text-slate-500">{formatDateTime(l.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
