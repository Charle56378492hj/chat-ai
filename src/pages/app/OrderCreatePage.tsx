import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Spinner, Badge } from '../../components/ui';
import { formatCurrency } from '../../lib/format';
import { Check, X, Send, Save, ShoppingCart, Bot, Sparkles } from 'lucide-react';

export function OrderCreatePage() {
  const navigate = useNavigate();
  const { products, customers } = useMerchantData();
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    city: '',
    address: '',
    productId: '',
    quantity: '1',
    discount: '0',
    shipping: '25',
    paymentMethod: 'cash',
    notes: '',
  });

  const selectedProduct = products.find((p) => p.id === form.productId);
  const subtotal = selectedProduct ? Number(selectedProduct.price) * Number(form.quantity) : 0;
  const total = subtotal - Number(form.discount) + Number(form.shipping);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!merchant || !selectedProduct) return;
    setSaving(true);
    try {
      let customerId = customers.find((c) => c.phone === form.phone)?.id;
      if (!customerId && form.phone) {
        const { data: newCustomer } = await supabase.from('customers').insert({
          merchant_id: merchant.id,
          name: form.customerName || 'عميل جديد',
          phone: form.phone,
          city: form.city,
          address: form.address,
        }).select().single();
        customerId = newCustomer?.id;
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const { data: order } = await supabase.from('orders').insert({
        merchant_id: merchant.id,
        customer_id: customerId ?? null,
        order_number: orderNumber,
        status: 'new',
        total,
        discount: Number(form.discount),
        shipping: Number(form.shipping),
        payment_method: form.paymentMethod,
        address: form.address,
        city: form.city,
        phone: form.phone,
        notes: form.notes,
      }).select().single();

      if (order) {
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: Number(form.quantity),
          unit_price: Number(selectedProduct.price),
          subtotal,
        });
      }
      navigate('/app/orders');
    } finally {
      setSaving(false);
    }
  }

  function autoFill() {
    setAiDetected(true);
    setForm({
      ...form,
      customerName: 'محمد العتيبي',
      phone: '+966 55 123 4567',
      city: 'الرياض',
      address: 'حي النرجس، شارع الأمير محمد',
      productId: products[0]?.id ?? '',
      quantity: '1',
    });
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="إنشاء طلب جديد"
        description="أنشئ طلبًا يدويًا أو من محادثة"
        actions={
          <button onClick={autoFill} className="btn-secondary btn-sm">
            <Sparkles size={16} /> تعبئة بالذكاء
          </button>
        }
      />

      {aiDetected && (
        <div className="card p-4 mb-4 bg-indigo-50 border-indigo-200">
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <Bot size={18} /> الذكاء الصناعي التقط بيانات الطلب من المحادثة تلقائيًا. راجعها قبل التأكيد.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <h3 className="font-bold text-slate-900 mb-3">بيانات العميل</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">اسم العميل</label>
              <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
            </div>
            <div>
              <label className="label">الهاتف *</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <label className="label">المدينة</label>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="label">العنوان</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 mb-3">المنتج</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">المنتج *</label>
              <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                <option value="">اختر منتجًا</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.price), merchant?.currency)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الكمية</label>
              <input type="number" min="1" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">طريقة الدفع</label>
              <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="cash">الدفع عند الاستلام</option>
                <option value="card">بطاقة</option>
                <option value="transfer">تحويل</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 mb-3">الحساب</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">الخصم</label>
              <input type="number" className="input" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div>
              <label className="label">التوصيل</label>
              <input type="number" className="input" value={form.shipping} onChange={(e) => setForm({ ...form, shipping: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span className="font-semibold">{formatCurrency(subtotal, merchant?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الخصم</span><span className="font-semibold text-red-600">-{formatCurrency(Number(form.discount), merchant?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">التوصيل</span><span className="font-semibold">{formatCurrency(Number(form.shipping), merchant?.currency)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-900">الإجمالي</span><span className="font-extrabold text-sky-600 text-lg">{formatCurrency(total, merchant?.currency)}</span></div>
          </div>
        </div>

        <div>
          <label className="label">ملاحظات</label>
          <textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/app/orders')} className="btn-secondary flex-1"><X size={16} /> إلغاء</button>
          <button type="button" className="btn-secondary flex-1"><Save size={16} /> حفظ كمسودة</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Spinner size="sm" /> : <><Check size={16} /> تأكيد الطلب</>}</button>
        </div>
      </form>
    </div>
  );
}
