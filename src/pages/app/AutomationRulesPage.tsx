import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { Plus, Zap, Power, Copy, Trash2, Play, ArrowUp, ArrowDown, X, Search } from 'lucide-react';
import type { AutomationRule } from '../../lib/types';

const exampleRules = [
  { name: 'عرض السعر', keyword: 'السعر', action: 'عرض السعر مباشرة' },
  { name: 'قائمة مختصرة', keyword: 'بكم', action: 'إرسال قائمة مختصرة' },
  { name: 'بدء الطلب', keyword: 'أريد الطلب', action: 'بدء جمع البيانات' },
  { name: 'تأكيد الإلغاء', keyword: 'ألغِ', action: 'طلب تأكيد الإلغاء' },
  { name: 'تحويل غاضب', keyword: 'غاضب', action: 'تحويل لموظف' },
  { name: 'رد خارج الدوام', keyword: 'خارج الدوام', action: 'رد تلقائي' },
];

export function AutomationRulesPage() {
  const { automationRules, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  async function toggle(rule: AutomationRule) {
    await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    reload();
  }

  async function remove(id: string) {
    if (!confirm('حذف هذه القاعدة؟')) return;
    await supabase.from('automation_rules').delete().eq('id', id);
    reload();
  }

  async function duplicate(rule: AutomationRule) {
    const { id: _id, created_at: _c, merchant_id: _m, ...rest } = rule;
    void _id; void _c; void _m;
    await supabase.from('automation_rules').insert({ ...rest, merchant_id: merchant?.id, name: `${rule.name} (نسخة)` });
    reload();
  }

  async function reorder(rule: AutomationRule, dir: 'up' | 'down') {
    const newPriority = dir === 'up' ? rule.priority + 1 : rule.priority - 1;
    await supabase.from('automation_rules').update({ priority: newPriority }).eq('id', rule.id);
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="قواعد الأتمتة"
        description={`${automationRules.length} قاعدة`}
        actions={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> قاعدة جديدة</button>}
      />

      {automationRules.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <EmptyState icon={<Zap size={28} />} title="لا توجد قواعد" description="أنشئ قواعد لتحكم كيف يرد الذكاء على رسائل معينة." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> قاعدة جديدة</button>} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-3">قواعد مقترحة</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {exampleRules.map((r) => (
                <div key={r.name} className="card p-4">
                  <div className="font-bold text-sm text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500 mt-1">إذا كتب: "{r.keyword}"</div>
                  <div className="text-xs text-sky-600 mt-1">→ {r.action}</div>
                  <button onClick={() => { setEditing({ id: '', merchant_id: merchant?.id ?? '', name: r.name, trigger_keyword: r.keyword, condition: {}, action: { type: r.action }, priority: 0, is_active: true, created_at: '' }); setShowForm(true); }} className="mt-3 text-sm text-sky-600 font-semibold">استخدام</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-right">
                <th className="p-4 text-sm font-bold text-slate-600">القاعدة</th>
                <th className="p-4 text-sm font-bold text-slate-600">الكلمة المفتاحية</th>
                <th className="p-4 text-sm font-bold text-slate-600">الأولوية</th>
                <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                <th className="p-4 text-sm font-bold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {automationRules.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 text-sm font-bold text-slate-900">{r.name}</td>
                  <td className="p-4"><Badge color="sky">{r.trigger_keyword ?? '—'}</Badge></td>
                  <td className="p-4 text-sm text-slate-600">{r.priority}</td>
                  <td className="p-4"><Badge color={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'مفعّلة' : 'معطّلة'}</Badge></td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => toggle(r)} className="p-1.5 rounded-lg hover:bg-slate-100" title="تفعيل/تعطيل"><Power size={16} /></button>
                      <button onClick={() => duplicate(r)} className="p-1.5 rounded-lg hover:bg-slate-100" title="نسخ"><Copy size={16} /></button>
                      <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="حذف"><Trash2 size={16} /></button>
                      <button onClick={() => reorder(r, 'up')} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowUp size={14} /></button>
                      <button onClick={() => reorder(r, 'down')} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowDown size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <RuleForm rule={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function RuleForm({ rule, onClose, onSaved }: { rule: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: rule?.name ?? '',
    trigger_keyword: rule?.trigger_keyword ?? '',
    action_type: 'reply',
    action_content: '',
    priority: rule?.priority?.toString() ?? '0',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    const data = {
      merchant_id: merchant.id,
      name: form.name,
      trigger_keyword: form.trigger_keyword,
      condition: { keyword: form.trigger_keyword },
      action: { type: form.action_type, content: form.action_content },
      priority: Number(form.priority) || 0,
      is_active: true,
    };
    if (rule?.id) {
      await supabase.from('automation_rules').update(data).eq('id', rule.id);
    } else {
      await supabase.from('automation_rules').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{rule?.id ? 'تعديل القاعدة' : 'قاعدة جديدة'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">اسم القاعدة *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">الكلمة المفتاحية</label>
            <input className="input" placeholder="السعر، بكم، أريد الطلب..." value={form.trigger_keyword} onChange={(e) => setForm({ ...form, trigger_keyword: e.target.value })} />
          </div>
          <div>
            <label className="label">نوع الإجراء</label>
            <select className="input" value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })}>
              <option value="reply">رد برسالة</option>
              <option value="create_order">إنشاء طلب</option>
              <option value="transfer_human">تحويل لموظف</option>
              <option value="send_catalog">إرسال كتالوج</option>
            </select>
          </div>
          <div>
            <label className="label">محتوى الإجراء</label>
            <textarea className="input min-h-[80px]" placeholder="نص الرد أو التعليمات..." value={form.action_content} onChange={(e) => setForm({ ...form, action_content: e.target.value })} />
          </div>
          <div>
            <label className="label">الأولوية</label>
            <input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size="sm" /> : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
