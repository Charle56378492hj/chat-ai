import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { ROLES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import { Plus, Users, Mail, Edit, Trash2, Ban, Send, X, UserPlus, Shield } from 'lucide-react';
import type { MerchantMember, Role } from '../../lib/types';

const permissions = [
  'قراءة فقط', 'الرد على المحادثات', 'تعديل الطلبات', 'إضافة منتجات',
  'إدارة الإعدادات', 'إدارة الاشتراك', 'مشاهدة التقارير', 'حذف البيانات', 'الوصول لسجلات الأمان',
];

export function TeamPage() {
  const { members, loading, reload } = useMerchantData();
  const { merchant, user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MerchantMember | null>(null);

  async function remove(id: string) {
    if (!confirm('حذف هذا العضو؟')) return;
    await supabase.from('merchant_members').delete().eq('id', id);
    reload();
  }

  async function suspend(id: string, currentStatus: string) {
    await supabase.from('merchant_members').update({ status: currentStatus === 'active' ? 'suspended' : 'active' }).eq('id', id);
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="الفريق والصلاحيات"
        description={`${members.length} عضو`}
        actions={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><UserPlus size={16} /> إضافة عضو</button>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {members.length === 0 ? (
            <div className="card">
              <EmptyState icon={<Users size={28} />} title="لا يوجد أعضاء" description="ادعُ أعضاء فريقك للانضمام." />
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-right">
                    <th className="p-4 text-sm font-bold text-slate-600">العضو</th>
                    <th className="p-4 text-sm font-bold text-slate-600">الدور</th>
                    <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                    <th className="p-4 text-sm font-bold text-slate-600">انضم في</th>
                    <th className="p-4 text-sm font-bold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const role = ROLES.find((r) => r.value === m.role);
                    return (
                      <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                              {m.invited_email?.charAt(0) ?? '؟'}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{m.invited_email ?? user?.email}</div>
                              {m.user_id && <div className="text-xs text-green-600">انضم</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><Badge color={m.role === 'owner' ? 'amber' : 'sky'}>{role?.label ?? m.role}</Badge></td>
                        <td className="p-4"><Badge color={m.status === 'active' ? 'green' : 'red'}>{m.status === 'active' ? 'نشط' : 'موقوف'}</Badge></td>
                        <td className="p-4 text-sm text-slate-500">{formatDateTime(m.created_at)}</td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditing(m); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100"><Edit size={16} /></button>
                            <button onClick={() => suspend(m.id, m.status)} className="p-1.5 rounded-lg hover:bg-slate-100"><Ban size={16} /></button>
                            {m.role !== 'owner' && <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Shield size={18} className="text-sky-500" /> الصلاحيات حسب الدور</h3>
          <div className="space-y-3">
            {ROLES.map((r) => (
              <div key={r.value}>
                <div className="font-semibold text-sm text-slate-900 mb-1">{r.label}</div>
                <div className="text-xs text-slate-500">
                  {r.value === 'owner' && 'كل الصلاحيات'}
                  {r.value === 'admin' && 'كل الصلاحيات عدا الحذف النهائي'}
                  {r.value === 'support' && 'الرد على المحادثات، تعديل الطلبات'}
                  {r.value === 'sales' && 'الرد، إنشاء طلبات، عرض المنتجات'}
                  {r.value === 'warehouse' && 'تغيير حالة الطلبات، المخزون'}
                  {r.value === 'viewer' && 'قراءة فقط'}
                  {r.value === 'finance' && 'الفوترة، الفواتير، التقارير'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && <MemberForm member={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: MerchantMember | null; onClose: () => void; onSaved: () => void }) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invited_email: member?.invited_email ?? '',
    role: (member?.role ?? 'support') as Role,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    if (member?.id) {
      await supabase.from('merchant_members').update(form).eq('id', member.id);
    } else {
      await supabase.from('merchant_members').insert({ ...form, merchant_id: merchant.id, status: 'invited' });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{member?.id ? 'تعديل العضو' : 'دعوة عضو'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">البريد الإلكتروني *</label>
            <input type="email" className="input" required value={form.invited_email} onChange={(e) => setForm({ ...form, invited_email: e.target.value })} />
          </div>
          <div>
            <label className="label">الدور</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.filter((r) => r.value !== 'owner').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size="sm" /> : <><Send size={16} /> إرسال دعوة</>}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
