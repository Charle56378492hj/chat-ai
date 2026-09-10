import { useState } from 'react';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { Crown, Ban, RefreshCw, AlertTriangle, Eye, Download, TrendingUp, Users, DollarSign, Activity, Server, Shield } from 'lucide-react';
import { useEffect } from 'react';

interface AdminMerchant {
  id: string;
  company_name: string;
  owner_email: string;
  plan: string;
  status: string;
  messages: number;
  channels: number;
  created_at: string;
}

export function SuperAdminPage() {
  const { merchant } = useAuth();
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: merchantsData } = await supabase.from('merchants').select('id, company_name, owner_id, created_at, is_active');
      const { data: subs } = await supabase.from('subscriptions').select('*');
      const { data: convs } = await supabase.from('conversations').select('merchant_id');
      const { data: chs } = await supabase.from('channels').select('merchant_id');

      const result: AdminMerchant[] = (merchantsData ?? []).map((m) => {
        const sub = subs?.find((s) => s.merchant_id === m.id);
        return {
          id: m.id,
          company_name: m.company_name,
          owner_email: m.owner_id.slice(0, 8) + '...',
          plan: sub?.plan ?? 'free',
          status: m.is_active ? 'active' : 'suspended',
          messages: convs?.filter((c) => c.merchant_id === m.id).length ?? 0,
          channels: chs?.filter((c) => c.merchant_id === m.id).length ?? 0,
          created_at: m.created_at,
        };
      });
      setMerchants(result);
      setLoading(false);
    }
    load();
  }, []);

  async function toggleMerchant(id: string, isActive: boolean) {
    await supabase.from('merchants').update({ is_active: !isActive }).eq('id', id);
    setMerchants((prev) => prev.map((m) => m.id === id ? { ...m, status: !isActive ? 'active' : 'suspended' } : m));
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter((m) => m.status === 'active').length;
  const totalMessages = merchants.reduce((s, m) => s + m.messages, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="لوحة الإدارة العليا" description="إدارة كل التجار والمنصة" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'إجمالي التجار', value: totalMerchants, icon: Users, color: 'sky' },
          { label: 'تجار نشطون', value: activeMerchants, icon: Activity, color: 'green' },
          { label: 'إجمالي الرسائل', value: totalMessages, icon: TrendingUp, color: 'violet' },
          { label: 'البنية التحتية', value: '98.9%', icon: Server, color: 'amber' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 bg-${s.color}-50 text-${s.color}-600`}><s.icon size={20} /></div>
            <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-right">
              <th className="p-4 text-sm font-bold text-slate-600">التاجر</th>
              <th className="p-4 text-sm font-bold text-slate-600">البريد</th>
              <th className="p-4 text-sm font-bold text-slate-600">الخطة</th>
              <th className="p-4 text-sm font-bold text-slate-600">القنوات</th>
              <th className="p-4 text-sm font-bold text-slate-600">الرسائل</th>
              <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
              <th className="p-4 text-sm font-bold text-slate-600">انضم في</th>
              <th className="p-4 text-sm font-bold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="p-4 text-sm font-bold text-slate-900">{m.company_name}</td>
                <td className="p-4 text-sm text-slate-600">{m.owner_email}</td>
                <td className="p-4"><Badge color="sky">{m.plan}</Badge></td>
                <td className="p-4 text-sm text-slate-600">{m.channels}</td>
                <td className="p-4 text-sm text-slate-600">{m.messages}</td>
                <td className="p-4"><Badge color={m.status === 'active' ? 'green' : 'red'}>{m.status === 'active' ? 'نشط' : 'موقوف'}</Badge></td>
                <td className="p-4 text-sm text-slate-500">{formatDateTime(m.created_at)}</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <button onClick={() => toggleMerchant(m.id, m.status === 'active')} className="p-1.5 rounded-lg hover:bg-slate-100" title={m.status === 'active' ? 'إيقاف' : 'تفعيل'}>
                      {m.status === 'active' ? <Ban size={16} className="text-red-500" /> : <RefreshCw size={16} className="text-green-500" />}
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-slate-100"><Eye size={16} /></button>
                    <button className="p-1.5 rounded-lg hover:bg-slate-100"><AlertTriangle size={16} className="text-amber-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Shield size={18} className="text-sky-500" /> الامتثال</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">شكاوى مفتوحة:</span><Badge color="amber">3</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">حالات حظر:</span><Badge color="red">1</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">مراجعة جودة:</span><Badge color="sky">5</Badge></div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><DollarSign size={18} className="text-green-500" /> الإيرادات</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">إجمالي شهري:</span><span className="font-bold text-slate-900">{formatCurrency(12450)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">تكلفة AI:</span><span className="font-bold text-red-600">{formatCurrency(2100)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">صافي الربح:</span><span className="font-bold text-green-600">{formatCurrency(10350)}</span></div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Download size={18} className="text-violet-500" /> تصدير</h3>
          <button className="btn-secondary btn-sm w-full mb-2"><Download size={14} /> تصدير بيانات النظام</button>
          <button className="btn-secondary btn-sm w-full"><Crown size={14} /> الدخول لحساب تاجر</button>
        </div>
      </div>
    </div>
  );
}
