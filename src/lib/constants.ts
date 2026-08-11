export const CHANNEL_TYPES = [
  { value: 'whatsapp', label: 'واتساب', icon: 'MessageCircle' },
  { value: 'messenger', label: 'ماسنجر', icon: 'Facebook' },
  { value: 'instagram', label: 'إنستغرام', icon: 'Instagram' },
  { value: 'telegram', label: 'تلغرام', icon: 'Send' },
  { value: 'website', label: 'شات الموقع', icon: 'Globe' },
  { value: 'sms', label: 'SMS', icon: 'Smartphone' },
  { value: 'email', label: 'بريد إلكتروني', icon: 'Mail' },
  { value: 'tiktok', label: 'تيك توك', icon: 'Music' },
  { value: 'tiktok_shop', label: 'تيك توك شوب', icon: 'ShoppingBag' },
  { value: 'google', label: 'Google Business', icon: 'Search' },
] as const;

export const ORDER_STATUSES = [
  { value: 'new', label: 'جديد', color: 'blue' },
  { value: 'pending_confirmation', label: 'بانتظار التأكيد', color: 'amber' },
  { value: 'confirmed', label: 'مؤكد', color: 'sky' },
  { value: 'preparing', label: 'قيد التجهيز', color: 'indigo' },
  { value: 'shipped', label: 'تم الشحن', color: 'violet' },
  { value: 'delivered', label: 'تم التسليم', color: 'green' },
  { value: 'cancelled', label: 'ملغي', color: 'red' },
  { value: 'returned', label: 'مرتجع', color: 'orange' },
  { value: 'late', label: 'متأخر', color: 'rose' },
  { value: 'follow_up', label: 'يحتاج متابعة', color: 'yellow' },
] as const;

export const CONVERSATION_STATUSES = [
  { value: 'open', label: 'مفتوحة', color: 'green' },
  { value: 'pending', label: 'بانتظار الرد', color: 'amber' },
  { value: 'assigned', label: 'محالة', color: 'sky' },
  { value: 'closed', label: 'مغلقة', color: 'gray' },
] as const;

export const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { value: 'openrouter', label: 'OpenRouter', models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5'] },
  { value: 'huggingface', label: 'Hugging Face', models: ['meta-llama/Llama-3-8b-chat', 'mistralai/Mistral-7B-Instruct'] },
] as const;

export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'مجاني',
    price: 0,
    period: 'شهري',
    description: 'ابدأ تجربتك مجانًا',
    features: ['قناة واحدة', '100 رسالة شهريًا', 'مساعد ذكاء أساسي', 'تقارير محدودة', 'دعم بالبريد'],
    cta: 'جرّب مجانًا',
    highlight: false,
  },
  {
    id: 'basic',
    name: 'أساسي',
    price: 99,
    period: 'شهري',
    description: 'للأعمال الصغيرة',
    features: ['3 قنوات', '5000 رسالة شهريًا', 'مساعد ذكاء متقدم', 'تقارير كاملة', '5 أعضاء فريق', 'دعم بالشات'],
    cta: 'اشترك الآن',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'احترافي',
    price: 299,
    period: 'شهري',
    description: 'للشركات المتوسطة',
    features: ['قنوات غير محدودة', 'رسائل غير محدودة', 'ذكاء صناعي متكامل', 'أتمتة متقدمة', 'أعضاء غير محدودين', 'API كامل', 'دعم أولوية 24/7'],
    cta: 'اشترك الآن',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'مؤسسي',
    price: null,
    period: 'مخصص',
    description: 'للمؤسسات الكبيرة',
    features: ['كل مميزات الاحترافي', 'مدير حساب مخصص', 'تدريب مخصص للذكاء', 'اتفاقية مستوى خدمة SLA', 'تكاملات مخصصة', 'أمان متقدم'],
    cta: 'تحدث مع المبيعات',
    highlight: false,
  },
] as const;

export const ROLES = [
  { value: 'owner', label: 'مالك' },
  { value: 'admin', label: 'مدير' },
  { value: 'support', label: 'دعم' },
  { value: 'sales', label: 'مبيعات' },
  { value: 'warehouse', label: 'مستودع' },
  { value: 'viewer', label: 'مشاهد' },
  { value: 'finance', label: 'مالية' },
] as const;

export const TEMPLATE_CATEGORIES = [
  { value: 'welcome', label: 'رسالة ترحيب' },
  { value: 'absence', label: 'رسالة غياب' },
  { value: 'order_confirmation', label: 'تأكيد طلب' },
  { value: 'shipping', label: 'شحن' },
  { value: 'follow_up', label: 'متابعة' },
  { value: 'return', label: 'استرجاع' },
  { value: 'discount', label: 'خصومات' },
  { value: 'vip', label: 'VIP' },
  { value: 'rejection', label: 'رفض بأدب' },
  { value: 'transfer', label: 'تحويل لموظف' },
] as const;

export const COUNTRIES = [
  { value: 'SA', label: 'السعودية', currency: 'SAR' },
  { value: 'AE', label: 'الإمارات', currency: 'AED' },
  { value: 'EG', label: 'مصر', currency: 'EGP' },
  { value: 'KW', label: 'الكويت', currency: 'KWD' },
  { value: 'QA', label: 'قطر', currency: 'QAR' },
  { value: 'BH', label: 'البحرين', currency: 'BHD' },
  { value: 'OM', label: 'عمان', currency: 'OMR' },
  { value: 'JO', label: 'الأردن', currency: 'JOD' },
  { value: 'IQ', label: 'العراق', currency: 'IQD' },
  { value: 'MA', label: 'المغرب', currency: 'MAD' },
  { value: 'DZ', label: 'الجزائر', currency: 'DZD' },
  { value: 'TN', label: 'تونس', currency: 'TND' },
  { value: 'LY', label: 'ليبيا', currency: 'LYD' },
  { value: 'SY', label: 'سوريا', currency: 'SYP' },
  { value: 'LB', label: 'لبنان', currency: 'LBP' },
  { value: 'PS', label: 'فلسطين', currency: 'ILS' },
  { value: 'SD', label: 'السودان', currency: 'SDG' },
  { value: 'YE', label: 'اليمن', currency: 'YER' },
  { value: 'MR', label: 'موريتانيا', currency: 'MRO' },
  { value: 'SO', label: 'الصومال', currency: 'SOS' },
] as const;
