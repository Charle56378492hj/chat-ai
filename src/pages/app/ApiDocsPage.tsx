import { PageHeader, Badge } from '../../components/ui';
import { Code, Key, Webhook, Copy, Check, Terminal } from 'lucide-react';
import { useState } from 'react';

export function ApiDocsPage() {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="API / Developer" description="توثيق ومفاتيح API" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Code size={18} className="text-sky-500" /> نقاط النهاية</h3>
            <div className="space-y-3">
              {[
                { method: 'GET', path: '/api/v1/conversations', desc: 'جلب كل المحادثات' },
                { method: 'POST', path: '/api/v1/messages', desc: 'إرسال رسالة' },
                { method: 'GET', path: '/api/v1/orders', desc: 'جلب الطلبات' },
                { method: 'POST', path: '/api/v1/orders', desc: 'إنشاء طلب' },
                { method: 'GET', path: '/api/v1/products', desc: 'جلب المنتجات' },
                { method: 'POST', path: '/api/v1/products', desc: 'إضافة منتج' },
                { method: 'GET', path: '/api/v1/customers', desc: 'جلب العملاء' },
                { method: 'POST', path: '/api/v1/webhooks', desc: 'تسجيل webhook' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <Badge color={ep.method === 'GET' ? 'green' : 'blue'}>{ep.method}</Badge>
                  <code className="text-sm font-mono text-slate-700 flex-1">{ep.path}</code>
                  <span className="text-xs text-slate-500">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Terminal size={18} className="text-violet-500" /> مثال</h3>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-sm overflow-x-auto font-mono">{`curl -X POST https://api.raddali.com/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversation_id": "uuid",
    "content": "أهلًا بك!"
  }'`}</pre>
              <button onClick={() => copy('curl example')} className="absolute top-3 left-3 p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Webhook size={18} className="text-amber-500" /> Webhooks</h3>
            <p className="text-sm text-slate-600 mb-3">استقبل إشعارات لحظية عند حدوث أحداث:</p>
            <div className="space-y-2">
              {['message.received', 'message.sent', 'order.created', 'order.updated', 'conversation.assigned', 'ai.handoff'].map((e) => (
                <div key={e} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <code className="text-sm font-mono text-slate-700">{e}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Key size={18} className="text-sky-500" /> مفاتيح API</h3>
            <div className="space-y-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-700">Production</span>
                  <Badge color="green">نشط</Badge>
                </div>
                <code className="text-xs font-mono text-slate-500">rda_live_****x9f2</code>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-700">Test</span>
                  <Badge color="gray">test</Badge>
                </div>
                <code className="text-xs font-mono text-slate-500">rda_test_****a1b3</code>
              </div>
            </div>
            <button className="btn-primary btn-sm w-full mt-3"><Key size={14} /> إنشاء مفتاح</button>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3">معلومات الاستخدام</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">طلبات اليوم:</span><span className="font-semibold">1,240</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الحد:</span><span className="font-semibold">10,000/شهر</span></div>
              <div className="flex justify-between"><span className="text-slate-500">معدل الخطأ:</span><Badge color="green">0.2%</Badge></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
