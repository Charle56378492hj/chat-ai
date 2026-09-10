import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Logo, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { ORDER_STATUSES } from '../../lib/constants';
import { Package, Truck, CheckCircle2, MapPin, Phone, Download, RotateCcw, MessageCircle, Check, Search } from 'lucide-react';
import type { Order, OrderItem } from '../../lib/types';

export function CustomerPortalPage() {
  const { token } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) return;
      const { data: tokenRow } = await supabase.from('customer_portal_tokens').select('order_id').eq('token', token).maybeSingle();
      if (!tokenRow) { setNotFound(true); setLoading(false); return; }
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', tokenRow.order_id).maybeSingle();
      if (!orderData) { setNotFound(true); setLoading(false); return; }
      setOrder(orderData as Order);
      const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', orderData.id);
      setItems(itemsData ?? []);
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (notFound || !order) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card p-8 text-center max-w-md">
        <EmptyState icon={<Package size={28} />} title="الطلب غير موجود" description="رابط التتبع غير صالح أو منتهي الصلاحية." action={<Link to="/" className="btn-primary btn-sm">العودة للرئيسية</Link>} />
      </div>
    </div>
  );

  const status = ORDER_STATUSES.find((s) => s.value === order.status);
  const statusSteps = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const currentStepIdx = statusSteps.indexOf(order.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <Badge color={status?.color ?? 'gray'}>{status?.label ?? order.status}</Badge>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">تتبع الطلب {order.order_number ?? `#${order.id.slice(0, 8)}`}</h1>
          <p className="text-slate-500 mt-1">{formatDateTime(order.created_at)}</p>
        </div>

        {/* Status timeline */}
        <div className="card p-6 mb-6">
          <h3 className="font-bold text-slate-900 mb-5">حالة الطلب</h3>
          <div className="flex justify-between items-center relative">
            <div className="absolute top-5 right-0 left-0 h-1 bg-slate-100" />
            <div className="absolute top-5 right-0 h-1 bg-sky-500 transition-all" style={{ width: `${(currentStepIdx / (statusSteps.length - 1)) * 100}%` }} />
            {statusSteps.map((step, i) => {
              const stepStatus = ORDER_STATUSES.find((s) => s.value === step);
              const done = i <= currentStepIdx;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center ${done ? 'bg-sky-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                    {done ? <Check size={18} /> : (stepStatus ? <Package size={18} /> : null)}
                  </div>
                  <span className={`text-xs font-semibold ${done ? 'text-sky-600' : 'text-slate-400'}`}>{stepStatus?.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3">معلومات التوصيل</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><MapPin size={16} /> {order.city ?? '—'}, {order.address ?? '—'}</div>
              <div className="flex items-center gap-2 text-slate-600"><Phone size={16} /> {order.phone ?? '—'}</div>
              {order.tracking_number && <div className="flex items-center gap-2 text-slate-600"><Truck size={16} /> رقم التتبع: {order.tracking_number}</div>}
              {order.courier && <div className="flex items-center gap-2 text-slate-600"><Package size={16} /> المندوب: {order.courier}</div>}
            </div>
            <button className="btn-secondary btn-sm mt-4 w-full"><MapPin size={14} /> تعديل العنوان</button>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3">تواصل معنا</h3>
            <p className="text-sm text-slate-600 mb-4">هل لديك سؤال؟ نحن هنا لمساعدتك.</p>
            <div className="space-y-2">
              <button className="btn-secondary btn-sm w-full"><MessageCircle size={14} /> تواصل مع الدعم</button>
              <button className="btn-secondary btn-sm w-full"><RotateCcw size={14} /> طلب استرجاع</button>
            </div>
          </div>
        </div>

        <div className="card p-5 mb-6">
          <h3 className="font-bold text-slate-900 mb-4">المنتجات</h3>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد منتجات</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-sm">{item.product_name}</div>
                    <div className="text-xs text-slate-500">{item.color ?? ''} {item.size ?? ''} × {item.quantity}</div>
                  </div>
                  <div className="font-bold text-slate-900">{formatCurrency(Number(item.subtotal))}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">الخصم</span><span className="font-semibold">-{formatCurrency(Number(order.discount))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">التوصيل</span><span className="font-semibold">{formatCurrency(Number(order.shipping))}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-100"><span className="font-bold text-slate-900">الإجمالي</span><span className="font-extrabold text-sky-600 text-lg">{formatCurrency(Number(order.total))}</span></div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1"><Download size={16} /> تحميل الفاتورة</button>
          {order.status !== 'delivered' && <button className="btn-primary flex-1"><Check size={16} /> تأكيد الاستلام</button>}
        </div>
      </div>
    </div>
  );
}
