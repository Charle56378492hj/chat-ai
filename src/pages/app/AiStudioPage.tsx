import { useState, type FormEvent, useEffect } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { AI_PROVIDERS } from '../../lib/constants';
import {
  Bot, Save, Play, RotateCcw, Eye, Power, Check,
  Sparkles, FileText, BookOpen, AlertCircle, Zap, MessageSquare,
  Key, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Scenarios for quick test ─────────────────────────────────────────────────
const scenarios = [
  'عميل يسأل عن السعر',
  'عميل يسأل عن المقاس',
  'عميل يريد خصم',
  'عميل غاضب',
  'عميل يكرر السؤال',
  'عميل يطلب إلغاء',
  'عميل يطلب استبدال',
  'عميل يكتب مختصر جدًا',
  'عميل يرسل صور',
];

const defaultRules = [
  'لا تذكر المنافسين أبدًا',
  'إذا سأل عن الدفع، اعطه تعليمات واضحة',
  'إذا تكرر السؤال 3 مرات، حوّل لموظف',
  'لا ترد بأكثر من 5 جمل في رسالة واحدة',
  'أضف emoji مناسب في كل رسالة',
];

// ─── Persona generator ────────────────────────────────────────────────────────
function buildSystemPrompt(config: {
  assistant_name: string;
  tone: string;
  formality: string;
  brevity: string;
  persuasion_level: number;
  mode: string;
  system_prompt: string | null;
}): string {
  const toneMap: Record<string, string> = {
    friendly: 'ودود ومرح',
    professional: 'احترافي وجاد',
    enthusiastic: 'متحمس وإيجابي',
    calm: 'هادئ ومتزن',
  };
  const brevityMap: Record<string, string> = {
    short: 'ردود قصيرة جداً في 1-2 جملة',
    medium: 'ردود متوسطة في 2-4 جمل',
    long: 'ردود مفصلة ومستوفية',
  };
  const modeMap: Record<string, string> = {
    sales: 'مساعد مبيعات يهدف لإتمام الصفقة بأسلوب لطيف غير ضاغط',
    support: 'مساعد دعم عملاء يحل المشكلات بصبر وكفاءة',
    full: 'مساعد شامل يجمع بين المبيعات والدعم',
  };

  const base = `أنت ${config.assistant_name}، مساعد ذكاء اصطناعي ${modeMap[config.mode] ?? 'للتجارة الإلكترونية'}.
أسلوبك ${toneMap[config.tone] ?? 'ودود'} و${config.formality === 'formal' ? 'رسمي' : 'غير رسمي'}.
اكتب ${brevityMap[config.brevity] ?? 'ردود متوسطة'}.
مستوى الإقناع: ${config.persuasion_level}/5.
قواعد مهمة:
- رد دائمًا باللغة العربية إلا إذا كتب العميل بلغة أخرى
- لا تختلق معلومات عن المنتجات إذا لم تعرفها
- كن صادقًا وأمينًا مع العميل
${config.system_prompt ? `\nتعليمات إضافية:\n${config.system_prompt}` : ''}`;
  return base;
}

// ─── Real AI call ──────────────────────────────────────────────────────────────
async function callAI(params: {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<string> {
  const { provider, model, apiKey, systemPrompt, userMessage } = params;

  if (!apiKey) {
    // Demo mode — simulate AI responses
    await new Promise((r) => setTimeout(r, 800));
    const demos: Record<string, string> = {
      'السعر': `أهلًا بك! 😊 يسعدني مساعدتك. سعر هذا المنتج هو 249 ريال فقط شامل الشحن. هل تحب تطلب الآن؟`,
      'المقاس': `أهلًا! 📦 المقاسات المتاحة: S، M، L، XL، XXL. ما هو مقاسك المعتاد لأساعدك باختيار الأنسب؟`,
      'خصم': `🎁 بالتأكيد! عندنا خصم 10% على الطلبات فوق 200 ريال. هل تحب أضيف الخصم لك؟`,
      'توصيل': `🚚 التوصيل خلال 2-4 أيام عمل. الشحن مجاني للطلبات فوق 150 ريال!`,
      'ألوان': `✨ المنتج متوفر بألوان: أسود، أبيض، كحلي، وأحمر. أيها يعجبك؟`,
      'إلغاء': `أفهم رغبتك تمامًا 😊 هل تحب أخبرني السبب لعلنا نجد حلاً يناسبك؟`,
      'غاضب': `أتفهم تمامًا شعورك وأعتذر عن هذا. دعني أساعدك بشكل شخصي لحل المشكلة الآن. 🙏`,
    };
    const key = Object.keys(demos).find((k) => userMessage.includes(k));
    return key
      ? demos[key]
      : `أهلًا بك! شكرًا لتواصلك معنا 😊 سأكون سعيدًا بمساعدتك. هل يمكنك إخباري بمزيد من التفاصيل عن استفسارك؟`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    let endpoint = '';
    let headers: Record<string, string> = {};
    let body: object = {};

    if (provider === 'openai') {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
      body = { model, messages, max_tokens: 300, temperature: 0.7 };
    } else if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'رد آلي',
      };
      body = { model, messages, max_tokens: 300, temperature: 0.7 };
    } else if (provider === 'huggingface') {
      endpoint = `https://api-inference.huggingface.co/models/${model}`;
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
      body = { inputs: `${systemPrompt}\n\nUser: ${userMessage}\nAssistant:`, parameters: { max_new_tokens: 300, temperature: 0.7 } };
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.generated_text) {
        const full = data[0].generated_text as string;
        const parts = full.split('Assistant:');
        return parts[parts.length - 1].trim();
      }
      throw new Error(data.error ?? 'HuggingFace error');
    } else {
      throw new Error(`مزوّد غير معروف: ${provider}`);
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? data.error);
    return (data.choices?.[0]?.message?.content as string | undefined) ?? 'لم أحصل على رد من المزوّد.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
    throw new Error(msg);
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function AiStudioPage() {
  const { aiConfig, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testError, setTestError] = useState('');
  const [activeTab, setActiveTab] = useState<'personality' | 'training' | 'rules' | 'api_key' | 'test'>('personality');
  const [showApiKey, setShowApiKey] = useState(false);

  const [config, setConfig] = useState({
    assistant_name: 'المساعد',
    tone: 'friendly',
    formality: 'casual',
    brevity: 'medium',
    persuasion_level: 3,
    mode: 'sales',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    fallback_to_human: true,
    system_prompt: '',
    api_key: '',
  });

  useEffect(() => {
    if (aiConfig) {
      setConfig({
        assistant_name: aiConfig.assistant_name ?? 'المساعد',
        tone: aiConfig.tone ?? 'friendly',
        formality: aiConfig.formality ?? 'casual',
        brevity: aiConfig.brevity ?? 'medium',
        persuasion_level: aiConfig.persuasion_level ?? 3,
        mode: aiConfig.mode ?? 'sales',
        ai_provider: aiConfig.ai_provider ?? 'openai',
        ai_model: aiConfig.ai_model ?? 'gpt-4o-mini',
        fallback_to_human: aiConfig.fallback_to_human ?? true,
        system_prompt: aiConfig.system_prompt ?? '',
        api_key: (aiConfig as Record<string, unknown>).api_key as string ?? '',
      });
    }
  }, [aiConfig]);

  const currentProvider = AI_PROVIDERS.find((p) => p.value === config.ai_provider);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    try {
      const payload = {
        assistant_name: config.assistant_name,
        tone: config.tone,
        formality: config.formality,
        brevity: config.brevity,
        persuasion_level: config.persuasion_level,
        mode: config.mode,
        ai_provider: config.ai_provider,
        ai_model: config.ai_model,
        fallback_to_human: config.fallback_to_human,
        system_prompt: config.system_prompt,
        api_key: config.api_key,
        is_active: true,
      };
      if (aiConfig) {
        await supabase.from('ai_configs').update(payload).eq('id', aiConfig.id);
      } else {
        await supabase.from('ai_configs').insert({ ...payload, merchant_id: merchant.id });
      }
      reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestOutput('');
    setTestError('');
    try {
      const systemPrompt = buildSystemPrompt(config);
      const reply = await callAI({
        provider: config.ai_provider,
        model: config.ai_model,
        apiKey: config.api_key,
        systemPrompt,
        userMessage: testInput,
      });
      setTestOutput(reply);
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : 'حدث خطأ أثناء الاختبار');
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const tabs = [
    { id: 'personality', label: 'الشخصية', icon: Bot },
    { id: 'training', label: 'التدريب', icon: BookOpen },
    { id: 'rules', label: 'القواعد', icon: FileText },
    { id: 'api_key', label: 'مفتاح API', icon: Key },
    { id: 'test', label: 'اختبار', icon: Play },
  ] as const;

  return (
    <form onSubmit={handleSave} className="animate-fade-in max-w-4xl">
      <PageHeader
        title="استوديو الذكاء الاصطناعي"
        description="درّب مساعدك الذكي وخصّصه ليناسب أسلوب تجارتك"
        actions={
          <div className="flex items-center gap-2">
            {aiConfig?.is_active && <Badge color="green">مفعّل</Badge>}
            {config.api_key ? (
              <Badge color="sky">API متصل</Badge>
            ) : (
              <Badge color="amber">وضع تجريبي</Badge>
            )}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : saved ? <><Check size={16} /> تم الحفظ</> : <><Save size={16} /> حفظ</>}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === t.id ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Personality ─────────────────────────────────────────── */}
      {activeTab === 'personality' && (
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Bot size={18} /> هوية المساعد</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">اسم المساعد</label>
                <input className="input" value={config.assistant_name}
                  onChange={(e) => setConfig({ ...config, assistant_name: e.target.value })} />
              </div>
              <div>
                <label className="label">نمط العمل</label>
                <select className="input" value={config.mode}
                  onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
                  <option value="sales">مبيعات 🛒</option>
                  <option value="support">دعم عملاء 🎧</option>
                  <option value="full">شامل (مبيعات + دعم) ⭐</option>
                </select>
              </div>
              <div>
                <label className="label">الأسلوب</label>
                <select className="input" value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}>
                  <option value="friendly">ودود 😊</option>
                  <option value="professional">احترافي 💼</option>
                  <option value="enthusiastic">متحمس ⚡</option>
                  <option value="calm">هادئ 🌿</option>
                </select>
              </div>
              <div>
                <label className="label">الرسمية</label>
                <select className="input" value={config.formality}
                  onChange={(e) => setConfig({ ...config, formality: e.target.value })}>
                  <option value="casual">غير رسمي (عامية)</option>
                  <option value="semiformal">شبه رسمي</option>
                  <option value="formal">رسمي</option>
                </select>
              </div>
              <div>
                <label className="label">طول الرد</label>
                <select className="input" value={config.brevity}
                  onChange={(e) => setConfig({ ...config, brevity: e.target.value })}>
                  <option value="short">قصير (1-2 جملة)</option>
                  <option value="medium">متوسط (3-4 جمل)</option>
                  <option value="long">مفصّل (5+ جمل)</option>
                </select>
              </div>
              <div>
                <label className="label">مستوى الإقناع: {config.persuasion_level}/5</label>
                <input type="range" min={1} max={5} className="w-full mt-2"
                  value={config.persuasion_level}
                  onChange={(e) => setConfig({ ...config, persuasion_level: +e.target.value })} />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>خفيف</span><span>متوسط</span><span>قوي</span>
                </div>
              </div>
            </div>

            {/* Toggle: fallback to human */}
            <label className="flex items-center gap-3 mt-5 cursor-pointer">
              <div
                className={`w-11 h-6 rounded-full transition-colors ${config.fallback_to_human ? 'bg-sky-500' : 'bg-slate-300'} relative`}
                onClick={() => setConfig({ ...config, fallback_to_human: !config.fallback_to_human })}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.fallback_to_human ? 'translate-x-5 left-1' : 'translate-x-0 left-1'}`} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">تحويل لموظف عند الحاجة</div>
                <div className="text-xs text-slate-500">يحوّل المحادثة لموظف بشري إذا لم يستطع الذكاء الإجابة</div>
              </div>
            </label>
          </div>

          {/* AI Provider */}
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Sparkles size={18} /> مزوّد الذكاء الاصطناعي</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">مزوّد AI</label>
                <select className="input" value={config.ai_provider}
                  onChange={(e) => setConfig({ ...config, ai_provider: e.target.value, ai_model: AI_PROVIDERS.find((p) => p.value === e.target.value)?.models[0] ?? '' })}>
                  {AI_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">النموذج</label>
                <select className="input" value={config.ai_model}
                  onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}>
                  {currentProvider?.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            {!config.api_key && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <div className="font-bold mb-0.5">وضع تجريبي</div>
                  لا يوجد API Key. الردود ستكون محاكاة تجريبية. أضف مفتاح API من تبويب <strong>مفتاح API</strong> لتفعيل الذكاء الحقيقي.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Training ─────────────────────────────────────────────── */}
      {activeTab === 'training' && (
        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><BookOpen size={18} /> بيانات التدريب</h3>
          <p className="text-sm text-slate-500 mb-4">
            أخبر المساعد كل ما يحتاج معرفته عن منتجاتك وسياساتك وأسلوب عملك.
          </p>
          <div>
            <label className="label">البرومبت الأساسي (System Prompt)</label>
            <textarea
              className="input min-h-[320px] font-mono text-sm"
              placeholder={`مثال:
نحن متجر ملابس نسائية اسمه "Moda Store".
المنتجات: فساتين، أطقم، عبايات.
الأسعار: بين 150 و 500 ريال.
الشحن: مجاني فوق 200 ريال.
سياسة الإرجاع: 7 أيام من الاستلام.
رقم خدمة العملاء: 0500000000

إذا سأل عن منتج غير موجود، قل له: "سنوفره قريبًا".
إذا طلب فاتورة، اطلب منه البريد الإلكتروني.`}
              value={config.system_prompt}
              onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
            />
            <div className="flex justify-between mt-2">
              <p className="text-xs text-slate-400">{config.system_prompt.length} حرف</p>
              <button
                type="button"
                className="text-xs text-sky-600 hover:underline"
                onClick={() => setConfig({ ...config, system_prompt: `نحن متجر [اسم المتجر].
المنتجات: [أنواع المنتجات].
نطاق الأسعار: [من X إلى Y].
الشحن: [مجاني/مدفوع] للطلبات [فوق/تحت] [المبلغ].
سياسة الإرجاع: [X أيام] من الاستلام.
أوقات العمل: [الأوقات].
للدعم البشري: [رقم/بريد].` })}
              >
                استخدم نموذج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rules ───────────────────────────────────────────────── */}
      {activeTab === 'rules' && (
        <RulesTab />
      )}

      {/* ── API Key ─────────────────────────────────────────────── */}
      {activeTab === 'api_key' && (
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Key size={18} /> مفتاح API الذكاء الاصطناعي</h3>
            <p className="text-sm text-slate-500 mb-5">
              أضف مفتاح API من مزوّدك لتفعيل الردود الحقيقية. المفتاح مشفّر ومحمي ولا يُشارك مع أحد.
            </p>

            <div className="space-y-4">
              {/* Current provider info */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
                <Sparkles size={18} className="text-sky-500" />
                <div>
                  <div className="font-semibold text-slate-800 text-sm">المزوّد الحالي: {currentProvider?.label}</div>
                  <div className="text-xs text-slate-500">النموذج: {config.ai_model}</div>
                </div>
                {config.api_key && <span className="ml-auto text-xs text-green-600 font-bold flex items-center gap-1"><Check size={12} /> مفعّل</span>}
              </div>

              <div>
                <label className="label">API Key</label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="input flex-1 font-mono text-sm"
                    placeholder={
                      config.ai_provider === 'openai' ? 'sk-...' :
                      config.ai_provider === 'openrouter' ? 'sk-or-...' : 'hf_...'
                    }
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="btn-secondary">
                    <Eye size={15} />
                  </button>
                </div>
              </div>

              {/* Provider-specific guides */}
              <div className="rounded-xl bg-sky-50 border border-sky-100 p-4">
                <div className="font-bold text-sky-800 text-sm mb-2">📋 كيف تحصل على المفتاح:</div>
                {config.ai_provider === 'openai' && (
                  <ol className="text-sm text-sky-700 list-decimal list-inside space-y-1">
                    <li>اذهب إلى <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline font-semibold">platform.openai.com/api-keys</a></li>
                    <li>اضغط "Create new secret key"</li>
                    <li>انسخ المفتاح وألصقه هنا</li>
                    <li>⚠️ تأكد من وجود رصيد في حسابك</li>
                  </ol>
                )}
                {config.ai_provider === 'openrouter' && (
                  <ol className="text-sm text-sky-700 list-decimal list-inside space-y-1">
                    <li>اذهب إلى <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline font-semibold">openrouter.ai/keys</a></li>
                    <li>سجّل دخول وأنشئ مفتاح جديد</li>
                    <li>OpenRouter يوفر نماذج متعددة بسعر منافس</li>
                  </ol>
                )}
                {config.ai_provider === 'huggingface' && (
                  <ol className="text-sm text-sky-700 list-decimal list-inside space-y-1">
                    <li>اذهب إلى <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="underline font-semibold">huggingface.co/settings/tokens</a></li>
                    <li>أنشئ User Access Token من نوع "Read"</li>
                    <li>انسخ التوكن وألصقه هنا</li>
                  </ol>
                )}
              </div>

              {config.api_key && (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={async () => {
                    try {
                      await callAI({
                        provider: config.ai_provider,
                        model: config.ai_model,
                        apiKey: config.api_key,
                        systemPrompt: 'أجب بكلمة واحدة فقط: مرحبا',
                        userMessage: 'اختبار',
                      });
                      alert('✅ المفتاح يعمل بشكل صحيح!');
                    } catch (e: unknown) {
                      alert(`❌ خطأ: ${e instanceof Error ? e.message : 'مفتاح غير صحيح'}`);
                    }
                  }}
                >
                  <RefreshCw size={15} /> اختبار المفتاح
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Test ────────────────────────────────────────────────── */}
      {activeTab === 'test' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-2">اختبار الرد الفعلي</h3>
            <p className="text-sm text-slate-500 mb-4">
              {config.api_key
                ? `✅ متصل بـ ${currentProvider?.label} — النموذج: ${config.ai_model}`
                : '⚠️ وضع تجريبي — أضف API Key من تبويب "مفتاح API" للردود الحقيقية'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">رسالة العميل</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="مثال: كم سعر المنتج؟ أو: عندك خصومات؟"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) runTest(); }}
                />
                <p className="text-xs text-slate-400 mt-1">Ctrl+Enter للاختبار السريع</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={runTest} disabled={testing || !testInput.trim()} className="btn-primary flex-1">
                  {testing ? <Spinner size="sm" /> : <><Play size={16} /> اختبار الرد</>}
                </button>
                {(testOutput || testError) && (
                  <button type="button" onClick={() => { setTestInput(''); setTestOutput(''); setTestError(''); }} className="btn-secondary btn-sm">
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>

              {testError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center gap-2 text-sm text-red-700 font-bold mb-1"><AlertCircle size={14} /> خطأ</div>
                  <p className="text-sm text-red-600">{testError}</p>
                </div>
              )}

              {testOutput && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold mb-2">
                    <Bot size={14} /> رد {config.assistant_name}
                    {config.api_key && <span className="text-green-500 font-normal">• رد حقيقي من {currentProvider?.label}</span>}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{testOutput}</p>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 mb-2">💬 جرّب هذه الأسئلة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['كم السعر؟', 'عندك خصم؟', 'كيف التوصيل؟', 'الألوان المتاحة؟', 'المقاسات؟', 'أريد إلغاء طلبي', 'الدفع بالبطاقة؟'].map((q) => (
                    <button type="button" key={q} onClick={() => setTestInput(q)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario selector */}
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 mb-2">🎯 سيناريوهات جاهزة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {scenarios.map((s) => (
                    <button type="button" key={s} onClick={() => setTestInput(s)}
                      className="text-xs bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 text-violet-600 hover:bg-violet-100 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────
function RulesTab() {
  const [rules, setRules] = useState<string[]>(defaultRules);
  const [newRule, setNewRule] = useState('');

  function addRule() {
    if (!newRule.trim()) return;
    setRules((prev) => [...prev, newRule.trim()]);
    setNewRule('');
  }

  function removeRule(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="card p-6">
      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><FileText size={18} /> قواعد المساعد</h3>
      <p className="text-sm text-slate-500 mb-4">حدّد القواعد التي يجب على المساعد اتباعها في كل المحادثات</p>
      <div className="space-y-2 mb-4">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
            <div className="h-2 w-2 rounded-full bg-sky-500 flex-shrink-0" />
            <span className="text-sm text-slate-700 flex-1">{rule}</span>
            <button type="button" onClick={() => removeRule(i)}
              className="text-slate-400 hover:text-red-500 transition-colors text-xs">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="أضف قاعدة جديدة..." value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }} />
        <button type="button" onClick={addRule} disabled={!newRule.trim()} className="btn-primary btn-sm">
          <Zap size={15} /> أضف
        </button>
      </div>
    </div>
  );
}
