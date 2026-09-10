import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { TEMPLATE_CATEGORIES } from '../../lib/constants';
import { Plus, FileText, Edit, Trash2, Copy, Eye, X, Search } from 'lucide-react';
import type { Template } from '../../lib/types';

export function TemplatesPage() {
  const { templates, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  const filtered = templates.filter((t) => !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()));

  async function remove(id: string) {
    if (!confirm('حذف هذا القالب؟')) return;
    await supabase.from('templates').delete().eq('id', id);
    reload();
  }

  async function duplicate(t: Template) {
    const { id: _id, created_at: _c, merchant_id: _m, ...rest } = t;
    void _id; void _c; void _m;
    await supabase.from('templates').insert({ ...rest, merchant_id: merchant?.id, title: `${t.title} (نسخة)` });
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="القوالب"
        description={`${templates.length} قالب`}
        actions={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> قالب جديد</button>}
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input className="input pr-10" placeholder="بحث في القوالب..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText size={28} />} title="لا توجد قوالب" description="أنشئ قوالب رسائل جاهزة للاستخدام السريع." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> قالب جديد</button>} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const cat = TEMPLATE_CATEGORIES.find((c) => c.value === t.category);
            return (
              <div key={t.id} className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <Badge color="sky">{cat?.label ?? t.category}</Badge>
                  <div className="flex gap-1">
                    <button onClick={() => setPreview(t)} className="p-1.5 rounded-lg hover:bg-slate-100"><Eye size={16} /></button>
                    <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100"><Edit size={16} /></button>
                    <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-slate-100"><Copy size={16} /></button>
                    <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-sm mb-1">{t.title ?? 'بدون عنوان'}</div>
                <p className="text-sm text-slate-600 line-clamp-3">{t.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <TemplateForm template={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TemplateForm({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: template?.category ?? 'welcome',
    title: template?.title ?? '',
    body: template?.body ?? '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    const data = { merchant_id: merchant.id, ...form };
    if (template?.id) {
      await supabase.from('templates').update(data).eq('id', template.id);
    } else {
      await supabase.from('templates').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{template?.id ? 'تعديل القالب' : 'قالب جديد'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">التصنيف</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">النص *</label>
            <textarea className="input min-h-[120px]" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="أهلًا بك في متجرنا! كيف نقدر نساعدك؟" />
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

function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{template.title ?? 'معاينة'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="p-6">
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sm text-slate-700 whitespace-pre-wrap">{template.body}</div>
        </div>
      </div>
    </div>
  );
}
