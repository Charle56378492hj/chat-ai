import { useParams, Link } from 'react-router-dom';
import { useMerchantData } from '../../lib/hooks';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDateTime, timeAgo } from '../../lib/format';
import { ORDER_STATUSES } from '../../lib/constants';
import { ArrowRight, Mail, ShoppingCart, StickyNote, Download, Trash2, Star, Merge, Edit } from 'lucide-react';

export function CustomerProfilePage() {
  const { id } = useParams();
  const { customers, orders, conversations, loading } = useMerchantData();
  const customer = customers.find((c) => c.id === id);
  const customerOrders = orders.filter((o) => o.customer_id === id);
  const customerConvs = conversations.filter((c) => c.customer_id === id);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!customer) return <div className="card"><EmptyState icon={<Star size={28} />} title="العميل غير موجود" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={customer.name ?? 'عميل'}
        description={customer.phone ?? ''}
        actions={<Link to="/app/customers" className="btn-secondary btn-sm"><ArrowRight size={16} /> رجوع</Link>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="text-center mb-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
              {customer.name?.charAt(0) ?? '؟'}
            </div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center justify-center gap-2">
              {customer.name ?? 'عميل'}
              {customer.vip && <Badge color="amber"><Star size={12} /> VIP</Badge>}
            </h3>
            <p className="text-sm text-slate-500">{customer.phone ?? '—'}</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">البريد</span><span className="font-semibold text-slate-700">{customer.email ?? '—'}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">المدينة</span><span className="font-semibold text-slate-700">{customer.city ?? '—'}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">العنوان</span><span className="font-semibold text-slate-700">{customer.address ?? '—'}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">القناة</span><span className="font-semibold text-slate-700">{customer.channel ?? '—'}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">آخر تواصل</span><span className="font-semibold text-slate-700">{timeAgo(customer.last_contact)}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">عدد الطلبات</span><span className="font-semibold text-slate-700">{customer.total_orders}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">إجمالي المشتريات</span><span className="font-bold text-sky-600">{formatCurrency(Number(customer.total_spent))}</span></div>
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 mb-2">العلامات</div>
              <div className="flex flex-wrap gap-1">{customer.tags.map((t) => <Badge key={t} color="sky">{t}</Badge>)}</div>
            </div>
          )}

          {customer.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 mb-1">ملاحظات</div>
              <p className="text-sm text-slate-600">{customer.notes}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            <button className="w-full btn-secondary btn-sm"><Edit size={14} /> تعديل</button>
            <button className="w-full btn-secondary btn-sm"><Mail size={14} /> إرسال رسالة</button>
            <button className="w-full btn-secondary btn-sm"><ShoppingCart size={14} /> إنشاء طلب</button>
            <button className="w-full btn-secondary btn-sm"><StickyNote size={14} /> إضافة ملاحظة</button>
            <button className="w-full btn-secondary btn-sm"><Merge size={14} /> دمج مع عميل آخر</button>
            <button className="w-full btn-secondary btn-sm"><Download size={14} /> تصدير البيانات</button>
            <button className="w-full btn-danger btn-sm"><Trash2 size={14} /> حذف</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4">طلبات العميل ({customerOrders.length})</h3>
            {customerOrders.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد طلبات</p>
            ) : (
              <div className="space-y-2">
                {customerOrders.map((o) => {
                  const status = ORDER_STATUSES.find((s) => s.value === o.status);
                  return (
                    <Link key={o.id} to="/app/orders" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                      <div className="h-9 w-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600"><ShoppingCart size={18} /></div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{o.order_number ?? `#${o.id.slice(0, 8)}`}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(o.created_at)} • {formatCurrency(Number(o.total))}</div>
                      </div>
                      {status && <Badge color={status.color}>{status.label}</Badge>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4">المحادثات ({customerConvs.length})</h3>
            {customerConvs.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد محادثات</p>
            ) : (
              <div className="space-y-2">
                {customerConvs.map((c) => (
                  <Link key={c.id} to="/app/inbox" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.last_message ?? 'محادثة'}</div>
                      <div className="text-xs text-slate-500">{timeAgo(c.last_message_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
