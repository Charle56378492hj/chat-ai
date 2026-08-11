import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { Plus, Workflow as WorkflowIcon, Power, Edit, Trash2, Copy, Play, X, Zap, ArrowRight } from 'lucide-react';
import type { Workflow } from '../../lib/types';

const exampleWorkflows = [
  { name: 'عرض المنتج', steps: 'سؤال عن منتج → إرسال صور + سعر + CTA' },
  { name: 'جمع البيانات', steps: 'إبداء اهتمام → سؤال عن المدينة → جمع العنوان → إنشاء طلب' },
  { name: 'متابعة 24 ساعة', steps: 'لا رد 24 ساعة → إرسال متابعة' },
  { name: 'تأكيد الدفع', steps: 'تم الدفع → تغيير الحالة → إرسال تأكيد' },
  { name: 'تنبيه مخزون', steps: 'انخفاض المخزون → إرسال تنبيه' },
  { name: 'تصعيد الشكاوي', steps: 'تكرر شكوى → إرسال للإدارة' },
];

export function WorkflowsPage() {
  const { workflows, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);

  async function toggle(wf: Workflow) {
    await supabase.from('workflows').update({ is_active: !wf.is_active }).eq('id', wf.id);
    reload();
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا Workflow؟')) return;
    await supabase.from('workflows').delete().eq('id', id);
    reload();
  }

  async function duplicate(wf: Workflow) {
    const { id: _id, created_at: _c, merchant_id: _m, ...rest } = wf;
    void _id; void _c; void _m;
    await supabase.from('workflows').insert({ ...rest, merchant_id: merchant?.id, name: `${wf.name} (نسخة)` });
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Workflows"
        description={`${workflows.length} workflow`}
        actions={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> إنشاء Workflow</button>}
      />

      {workflows.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <EmptyState icon={<WorkflowIcon size={28} />} title="لا توجد Workflows" description="أنشئ أتمتة متقدمة متعددة الخطوات." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> إنشاء Workflow</button>} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-3">أمثلة جاهزة</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {exampleWorkflows.map((w) => (
                <div key={w.name} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-amber-500" />
                    <span className="font-bold text-sm text-slate-900">{w.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-3">{w.steps}</div>
                  <button onClick={() => { setEditing({ id: '', merchant_id: merchant?.id ?? '', name: w.name, description: w.steps, steps: [], is_active: true, created_at: '' }); setShowForm(true); }} className="text-sm text-sky-600 font-semibold">استخدام</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div key={wf.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500"><WorkflowIcon size={20} /></div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{wf.name}</div>
                    <Badge color={wf.is_active ? 'green' : 'gray'}>{wf.is_active ? 'مفعّل' : 'متوقف'}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggle(wf)} className="p-1.5 rounded-lg hover:bg-slate-100"><Power size={16} /></button>
                  <button onClick={() => { setEditing(wf); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100"><Edit size={16} /></button>
                  <button onClick={() => duplicate(wf)} className="p-1.5 rounded-lg hover:bg-slate-100"><Copy size={16} /></button>
                  <button onClick={() => remove(wf.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="text-sm text-slate-600">{wf.description ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && <WorkflowForm workflow={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function WorkflowForm({ workflow, onClose, onSaved }: { workflow: Workflow | null; onClose: () => void; onSaved: () => void }) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: workflow?.name ?? '',
    description: workflow?.description ?? '',
  });
  const [steps, setSteps] = useState<{ trigger: string; action: string }[]>([{ trigger: '', action: '' }]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    const data = { merchant_id: merchant.id, name: form.name, description: form.description, steps: steps.filter((s) => s.trigger || s.action) };
    if (workflow?.id) {
      await supabase.from('workflows').update(data).eq('id', workflow.id);
    } else {
      await supabase.from('workflows').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{workflow?.id ? 'تعديل Workflow' : 'إنشاء Workflow'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">الاسم *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">الوصف</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">الخطوات</label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1" placeholder="المشغل (trigger)" value={s.trigger} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], trigger: e.target.value }; setSteps(n); }} />
                  <ArrowRight size={16} className="text-slate-400" />
                  <input className="input flex-1" placeholder="الإجراء (action)" value={s.action} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], action: e.target.value }; setSteps(n); }} />
                  {steps.length > 1 && <button type="button" onClick={() => setSteps(steps.filter((_, x) => x !== i))} className="p-2 text-red-500"><X size={16} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setSteps([...steps, { trigger: '', action: '' }])} className="btn-secondary btn-sm w-full"><Plus size={14} /> إضافة خطوة</button>
            </div>
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
