import { useState, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency } from '../../lib/format';
import {
  Plus, Search, Download, Upload, Edit, Trash2, Copy, Eye, EyeOff,
  Package, AlertTriangle, X,
} from 'lucide-react';
import type { Product } from '../../lib/types';

export function ProductsPage() {
  const { products, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));

  async function deleteProduct(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    await supabase.from('products').delete().eq('id', id);
    reload();
  }

  async function toggleStatus(p: Product) {
    await supabase.from('products').update({ status: p.status === 'active' ? 'hidden' : 'active' }).eq('id', p.id);
    reload();
  }

  async function duplicate(p: Product) {
    const { id: _id, created_at: _c, merchant_id: _m, ...rest } = p;
    void _id; void _c; void _m;
    await supabase.from('products').insert({ ...rest, merchant_id: merchant?.id, name: `${p.name} (نسخة)` });
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="المنتجات"
        description={`${products.length} منتج`}
        actions={
          <>
            <button className="btn-secondary btn-sm"><Upload size={16} /> استيراد</button>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> إضافة منتج</button>
          </>
        }
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input className="input pr-10" placeholder="بحث بالاسم أو SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package size={28} />} title="لا توجد منتجات" description="أضف منتجاتك ليتمكن الذكاء من عرضها وبيعها." action={<button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><Plus size={16} /> إضافة منتج</button>} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="card overflow-hidden group">
              <div className="aspect-square bg-slate-100 relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={40} /></div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {p.status === 'active' ? <Badge color="green">متاح</Badge> : <Badge color="gray">مخفي</Badge>}
                  {p.stock < 10 && <Badge color="red"><AlertTriangle size={10} /> منخفض</Badge>}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100"><Edit size={16} /></button>
                    <button onClick={() => toggleStatus(p)} className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100">{p.status === 'active' ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button onClick={() => duplicate(p)} className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100"><Copy size={16} /></button>
                    <button onClick={() => deleteProduct(p.id)} className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-900 text-sm truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">SKU: {p.sku ?? '—'}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-extrabold text-sky-600">{formatCurrency(Number(p.price), merchant?.currency)}</span>
                  <span className="text-xs text-slate-500">المخزون: {p.stock}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ProductForm product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    sku: product?.sku ?? '',
    price: product?.price?.toString() ?? '',
    cost: product?.cost?.toString() ?? '',
    stock: product?.stock?.toString() ?? '0',
    image_url: product?.image_url ?? '',
    shipping_days: product?.shipping_days?.toString() ?? '3',
    return_policy: product?.return_policy ?? '',
    keywords: product?.keywords?.join(', ') ?? '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    const data = {
      merchant_id: merchant.id,
      name: form.name,
      description: form.description,
      sku: form.sku || null,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      margin: Number(form.price) - Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      image_url: form.image_url || null,
      shipping_days: Number(form.shipping_days) || 3,
      return_policy: form.return_policy || null,
      keywords: form.keywords ? form.keywords.split(',').map((s) => s.trim()) : [],
    };
    if (product) {
      await supabase.from('products').update(data).eq('id', product.id);
    } else {
      await supabase.from('products').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">اسم المنتج *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">الوصف</label>
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="label">المخزون</label>
              <input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div>
              <label className="label">السعر *</label>
              <input type="number" step="0.01" className="input" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">التكلفة</label>
              <input type="number" step="0.01" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div>
              <label className="label">مدة الشحن (أيام)</label>
              <input type="number" className="input" value={form.shipping_days} onChange={(e) => setForm({ ...form, shipping_days: e.target.value })} />
            </div>
            <div>
              <label className="label">رابط الصورة</label>
              <input className="input" placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">سياسة الاسترجاع</label>
            <input className="input" value={form.return_policy} onChange={(e) => setForm({ ...form, return_policy: e.target.value })} />
          </div>
          <div>
            <label className="label">الكلمات المفتاحية (افصل بفاصلة)</label>
            <input className="input" placeholder="جاكيت, أزرق, شتاء" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
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
