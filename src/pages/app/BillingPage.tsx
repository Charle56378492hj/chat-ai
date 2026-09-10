import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PRICING_PLANS } from '../../lib/constants';
import { CreditCard, Download, Plus, RefreshCw, TrendingUp, Zap, MessageSquare, Bot, Check } from 'lucide-react';

export function BillingPage() {
  const { subscription, loading } = useMerchantData();
  const { merchant } = useAuth();

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const currentPlan = PRICING_PLANS.find((p) => p.id === (subscription?.plan ?? 'free')) ?? PRICING_PLANS[0];
  const usage = {
    messages: subscription?.message_count ?? 0,
    messageLimit: subscription?.message_limit ?? 100,
    channels: subscription?.channel_count ?? 0,
    channelLimit: subscription?.channel_limit ?? 1,
    aiCredits: subscription?.ai_credits_used ?? 0,
    aiLimit: subscription?.ai_credits_limit ?? 1000,
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="الفوترة" description="إدارة اشتراكك واستهلاكك" />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900">الخطة الحالية</h3>
            <Badge color="sky">{currentPlan.name}</Badge>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            {currentPlan.price !== null ? `${currentPlan.price} ريال` : 'مخصص'}
          </div>
          <p className="text-sm text-slate-500 mb-4">{currentPlan.description}</p>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm flex-1"><TrendingUp size={14} /> ترقية</button>
            <button className="btn-secondary btn-sm">تخفيض</button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">الاستهلاك</h3>
          <div className="space-y-4">
            <UsageBar icon={MessageSquare} label="الرسائل" used={usage.messages} limit={usage.messageLimit} />
            <UsageBar icon={Zap} label="القنوات" used={usage.channels} limit={usage.channelLimit} />
            <UsageBar icon={Bot} label="رصيد AI" used={usage.aiCredits} limit={usage.aiLimit} />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">التجديد</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">الحالة:</span><Badge color="green">نشط</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">التجديد التلقائي:</span><span className="font-semibold text-slate-700">{subscription?.auto_renew ? 'مفعّل' : 'معطل'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">نهاية الفترة:</span><span className="font-semibold text-slate-700">{formatDateTime(subscription?.current_period_end ?? null)}</span></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary btn-sm flex-1"><RefreshCw size={14} /> تجديد</button>
            <button className="btn-secondary btn-sm text-red-500">إلغاء</button>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-bold text-slate-900 mb-4">طرق الدفع</h3>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-14 rounded-lg bg-slate-100 flex items-center justify-center"><CreditCard size={20} className="text-slate-500" /></div>
            <div>
              <div className="font-semibold text-slate-700 text-sm">Visa **** 4242</div>
              <div className="text-xs text-slate-500">تنتهي 12/26</div>
            </div>
          </div>
          <Badge color="green">افتراضية</Badge>
        </div>
        <button className="btn-secondary btn-sm mt-3 w-full"><Plus size={14} /> إضافة وسيلة دفع</button>
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-slate-900 mb-4">الفواتير</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <div className="font-semibold text-slate-700 text-sm">فاتورة #{2026100 + i}</div>
                <div className="text-xs text-slate-500">{formatDateTime(new Date(Date.now() - i * 2592000000))}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900">{formatCurrency(currentPlan.price ?? 0, merchant?.currency)}</span>
                <Badge color="green">مدفوعة</Badge>
                <button className="text-sky-600"><Download size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageBar({ icon: Icon, label, used, limit }: { icon: typeof MessageSquare; label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 text-slate-600"><Icon size={14} /> {label}</span>
        <span className="font-semibold text-slate-700">{used} / {limit}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
