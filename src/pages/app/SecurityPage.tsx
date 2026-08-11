import { PageHeader, Badge } from '../../components/ui';
import { Shield, Smartphone, Key, LogOut, Eye, Download, RefreshCw, AlertTriangle, Check, Monitor } from 'lucide-react';

export function SecurityPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="الأمان" description="إدارة أمان حسابك وبياناتك" />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Shield size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">المصادقة الثنائية (2FA)</h3>
              <p className="text-sm text-slate-500">حماية إضافية لحسابك</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Badge color="green"><Check size={12} /> مفعّلة</Badge>
            <button className="btn-secondary btn-sm">إدارة</button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600"><Key size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">كلمة المرور</h3>
              <p className="text-sm text-slate-500">آخر تغيير: قبل 30 يوم</p>
            </div>
          </div>
          <button className="btn-secondary btn-sm w-full">تغيير كلمة المرور</button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600"><Monitor size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">الأجهزة الموثوقة</h3>
              <p className="text-sm text-slate-500">3 أجهزة نشطة</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { name: 'Chrome - Windows', last: 'الآن', current: true },
              { name: 'Safari - iPhone', last: 'منذ 2 ساعة', current: false },
              { name: 'Chrome - Android', last: 'منذ 3 أيام', current: false },
            ].map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.last}</div>
                </div>
                {d.current ? <Badge color="green">هذا الجهاز</Badge> : <button className="text-red-500 text-xs">إنهاء</button>}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Key size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">مفاتيح API</h3>
              <p className="text-sm text-slate-500">للتكامل مع أنظمة خارجية</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-slate-700">rda_****x9f2</div>
                <div className="text-xs text-slate-500">آخر استخدام: اليوم</div>
              </div>
              <button className="text-red-500 text-xs">إلغاء</button>
            </div>
          </div>
          <button className="btn-secondary btn-sm w-full mt-2"><Key size={14} /> إنشاء مفتاح جديد</button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><Eye size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">الجلسات المفتوحة</h3>
              <p className="text-sm text-slate-500">2 جلسة نشطة</p>
            </div>
          </div>
          <button className="btn-danger btn-sm w-full"><LogOut size={14} /> إنهاء كل الجلسات</button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600"><AlertTriangle size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">النشاط المشبوه</h3>
              <p className="text-sm text-slate-500">لا يوجد نشاط مشبوه</p>
            </div>
          </div>
          <button className="btn-secondary btn-sm w-full"><RefreshCw size={14} /> مراجعة النشاط</button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Download size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-900">تنزيل السجلات</h3>
              <p className="text-sm text-slate-500">سجلات الأمان والتدقيق</p>
            </div>
          </div>
          <button className="btn-secondary btn-sm w-full"><Download size={14} /> تنزيل السجلات</button>
        </div>
      </div>
    </div>
  );
}
