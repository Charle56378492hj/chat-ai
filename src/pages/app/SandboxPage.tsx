import { useState } from 'react';
import { PageHeader, Badge } from '../../components/ui';
import { FlaskConical, Play, RotateCcw, Send, Bot, Check, AlertTriangle, Smartphone } from 'lucide-react';

export function SandboxPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'customer', text: userMsg }]);
    setInput('');
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setMessages((prev) => [...prev, { sender: 'ai', text: `[Sandbox] هذا رد تجريبي على: "${userMsg}". في البيئة الحقيقية، الذكاء سيحلل نيتك ويستخرج البيانات ويرد بناءً على تدريبه.` }]);
    setTesting(false);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sandbox"
        description="تجربة الذكاء والربط قبل النشر"
        actions={<button onClick={() => setMessages([])} className="btn-secondary btn-sm"><RotateCcw size={16} /> مسح</button>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card flex flex-col h-[600px]">
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center gap-2">
            <Badge color="amber"><FlaskConical size={12} /> وضع التجربة</Badge>
            <span className="text-sm text-slate-500">لن يتم إرسال رسائل حقيقية</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-12">
                <Bot size={40} className="mx-auto mb-3" />
                <p className="text-sm">اكتب رسالة لتجربة الذكاء</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.sender === 'ai' ? 'justify-end' : ''}`}>
                {m.sender === 'customer' && <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">أ</div>}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === 'ai' ? 'bg-indigo-500 text-white rounded-tl-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'}`}>
                  {m.text}
                </div>
                {m.sender === 'ai' && <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-white" /></div>}
              </div>
            ))}
            {testing && (
              <div className="flex gap-2 justify-end">
                <div className="bg-indigo-500 text-white rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input className="input flex-1" placeholder="اكتب رسالة تجريبية..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runTest()} />
            <button onClick={runTest} disabled={testing} className="btn-primary"><Send size={18} /></button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Smartphone size={18} className="text-sky-500" /> لوحة الموبايل</h3>
            <p className="text-sm text-slate-600 mb-3">نسخة مختصرة لأصحاب المتاجر على الهاتف:</p>
            <div className="space-y-2">
              {['إشعارات فورية', 'ردود سريعة', 'موافقة على الطلبات', 'متابعة المحادثات'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-700"><Check size={14} className="text-green-500" /> {f}</div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> ملاحظات</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• رسائل Sandbox لا تصل للعملاء</li>
              <li>• الطلبات في Sandbox لا تُحتسب</li>
              <li>• استخدم Sandbox لاختبار التكاملات قبل النشر</li>
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-slate-900 mb-3">حالة النشر</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">الذكاء:</span><Badge color="green">منشور</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">القنوات:</span><Badge color="green">3 متصلة</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">القوالب:</span><Badge color="sky">5 جاهزة</Badge></div>
            </div>
            <button className="btn-primary btn-sm w-full mt-3"><Play size={14} /> نشر للإنتاج</button>
          </div>
        </div>
      </div>
    </div>
  );
}
