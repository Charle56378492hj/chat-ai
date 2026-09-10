/**
 * معالج الأوامر الذكية للوكيل
 * يفهم الأوامر الطبيعية في العربية ويحولها لإجراءات
 */

import type { Product, Order } from './types';

export type CommandType = 
  | 'view_orders'
  | 'view_products'
  | 'view_channels'
  | 'view_inventory'
  | 'send_message'
  | 'schedule_task'
  | 'update_order'
  | 'update_product'
  | 'analytics'
  | 'unknown';

export interface ParsedCommand {
  type: CommandType;
  action: string;
  parameters: Record<string, string | number | number[] | undefined>;
  confidence: number; // 0-1
  requiresConfirmation: boolean;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: unknown;
  requiresUserConfirmation?: boolean;
  confirmationPrompt?: string;
}

// قاموس الكلمات الدالة على أوامر معينة
const commandKeywords = {
  view_orders: [
    'طلبات', 'أوردر', 'orders', 'الطلبات', 'الطلبات الجديدة', 'الطلبات المعلقة',
    'طلبات قيد', 'طلبات جاهزة', 'طلبات مرتجعة', 'احتياج متابعة', 'معلقة', 'جديدة'
  ],
  view_products: [
    'منتجات', 'كتالوج', 'products', 'المنتجات', 'المنتج', 'الكتالوج',
    'قائمة المنتجات', 'عرض المنتجات'
  ],
  view_channels: [
    'قنوات', 'channels', 'القنوات', 'whatsapp', 'telegram',
    'القنوات المتصلة', 'الاتصالات', 'الربط'
  ],
  view_inventory: [
    'مخزون', 'inventory', 'stock', 'نفاد', 'قليل', 'كمية',
    'المخزون', 'المخزون القليل', 'المنتجات نفذت', 'الكمية'
  ],
  send_message: [
    'أرسل', 'ارسل', 'رسالة', 'message', 'send', 'اتصل', 'تواصل',
    'message', 'رسالة واتس', 'رسالة تيلجرام', 'رسالة بريد'
  ],
  schedule_task: [
    'جدول', 'schedule', 'كل يوم', 'تكرار', 'repeat', 'daily',
    'يومي', 'أسبوعي', 'شهري', 'تنبيه', 'تذكير', 'وقت محدد'
  ],
  update_order: [
    'حدّث', 'عدّل', 'غيّر حالة', 'تحديث', 'update', 'status',
    'حالة الطلب', 'ألغي', 'أكمل', 'شحنة', 'توصيل'
  ],
  update_product: [
    'تعديل منتج', 'تحديث منتج', 'حدّث المنتج', 'غيّر السعر',
    'غيّر المخزون', 'حدّث الصور', 'update product'
  ],
  analytics: [
    'تحليل', 'إحصائيات', 'تقرير', 'analytics', 'statistics', 'report',
    'مبيعات', 'أداء', 'performance', 'أرقام', 'بيانات'
  ],
};

// الكلمات التي تشير للأوامر الحساسة
const sensitiveActions = [
  'delete', 'cancel', 'remove', 'حذف', 'ألغي', 'أزل', 'أسقط'
];

export class CommandProcessor {
  /**
   * تحليل أمر المستخدم
   */
  static parseCommand(userInput: string): ParsedCommand {
    const input = userInput.toLowerCase().trim();
    
    // البحث عن النوع الأكثر احتمالاً
    let bestMatch: CommandType = 'unknown';
    let bestConfidence = 0;

    for (const [cmdType, keywords] of Object.entries(commandKeywords)) {
      const matches = keywords.filter(k => input.includes(k)).length;
      const confidence = matches / keywords.length;
      
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = cmdType as CommandType;
      }
    }

    // تحديد ما إذا كان يحتاج تأكيد
    const requiresConfirmation = sensitiveActions.some(action => input.includes(action));

    // استخراج المعاملات من النص
    const parameters = this.extractParameters(input, bestMatch);

    return {
      type: bestMatch,
      action: bestMatch === 'unknown' ? 'query' : bestMatch.replace('_', ' '),
      parameters,
      confidence: Math.max(bestConfidence, 0),
      requiresConfirmation,
    };
  }

  /**
   * استخراج المعاملات من النص
   */
  static extractParameters(input: string, cmdType: CommandType): Record<string, string | number | number[] | undefined> {
    const params: Record<string, string | number | number[] | undefined> = {};

    // استخراج الأرقام (للقيمة المالية أو الكمية)
    const numberMatches = input.match(/\d+/g);
    if (numberMatches) {
      params.values = numberMatches.map(Number);
    }

    // استخراج أرقام الهواتف
    const phoneMatch = input.match(/(?:\+?\d[\d\s-]{7,})/);
    if (phoneMatch) {
      params.phone = phoneMatch[0].replace(/[^\d+]/g, '');
    }

    // استخراج الساعات (للجدولة)
    const hourMatch = input.match(/(\d{1,2})\s*(صباح|مساء|:|am|pm)/);
    if (hourMatch) {
      params.hour = parseInt(hourMatch[1]);
      if (hourMatch[2].includes('مساء') || hourMatch[2].toLowerCase().includes('pm')) {
        params.hour += 12;
      }
    }

    // استخراج الحالات
    if (cmdType === 'update_order') {
      const states = ['جديد', 'معالجة', 'شحن', 'مرتجع', 'ملغي', 'مكتمل'];
      const foundState = states.find(s => input.includes(s));
      if (foundState) params.newStatus = foundState.toLowerCase();
    }

    // استخراج نطاقات التاريخ
    if (input.includes('اليوم')) params.timeRange = 'today';
    if (input.includes('أمس')) params.timeRange = 'yesterday';
    if (input.includes('هذا الأسبوع')) params.timeRange = 'week';
    if (input.includes('هذا الشهر')) params.timeRange = 'month';

    // استخراج الترتيب (الأكثر، الأقل، إلخ)
    if (input.includes('الأعلى') || input.includes('الأكثر')) params.sort = 'desc';
    if (input.includes('الأقل') || input.includes('الأدنى')) params.sort = 'asc';

    return params;
  }

  /**
   * معالجة الأمر على البيانات الفعلية
   */
  static processCommand(
    parsed: ParsedCommand,
    data: {
      orders?: Order[];
      products?: Product[];
      channels?: Array<{ id: string; type: string; name?: string; is_active?: boolean }>;
    }
  ): CommandResponse {
    switch (parsed.type) {
      case 'view_orders':
        return this.handleViewOrders(data.orders || [], parsed.parameters);
      
      case 'view_products':
        return this.handleViewProducts(data.products || [], parsed.parameters);
      
      case 'view_channels':
        return this.handleViewChannels(data.channels || [], parsed.parameters);
      
      case 'view_inventory':
        return this.handleViewInventory(data.products || [], parsed.parameters);
      
      case 'send_message':
        return {
          success: true,
          message: 'إعداد الرسالة للإرسال',
          requiresUserConfirmation: true,
          confirmationPrompt: 'هل تريد حقاً إرسال هذه الرسالة؟',
        };
      
      case 'schedule_task':
        return {
          success: true,
          message: 'جدولة المهمة',
          requiresUserConfirmation: true,
          confirmationPrompt: `ستتكرر هذه المهمة يومياً في الساعة ${parsed.parameters.hour || 9}:00`,
        };
      
      default:
        return {
          success: false,
          message: 'لم أفهم هذا الأمر بشكل كامل',
        };
    }
  }

  private static handleViewOrders(orders: Order[], params: Record<string, string | number | number[] | undefined>): CommandResponse {
    if (!orders || orders.length === 0) {
      return { success: true, message: '✅ لا توجد طلبات حالياً' };
    }

    let filtered = [...orders];

    // تطبيق الفلاتر
    if (params.timeRange) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(o => new Date(o.created_at || '') >= startOfDay);
    }

    const summary = filtered
      .slice(0, 10)
      .map((o, i) => `${i + 1}. طلب #${o.id?.slice(-4) || 'N/A'} - ${o.total || 0} ريال - ${o.status}`)
      .join('\n');

    return {
      success: true,
      message: `📋 الطلبات (${filtered.length}):\n\n${summary}`,
      data: { orders: filtered },
    };
  }

  private static handleViewProducts(products: Product[], _params: Record<string, string | number | number[] | undefined>): CommandResponse {
    if (!products || products.length === 0) {
      return { success: true, message: '❌ لا توجد منتجات' };
    }

    const active = products.filter(p => p.status === 'active');
    const summary = active
      .slice(0, 10)
      .map((p, i) => `${i + 1}. ${p.name} - ${p.price} ريال (${p.stock || 0} قطع)`)
      .join('\n');

    return {
      success: true,
      message: `📦 المنتجات النشطة (${active.length}):\n\n${summary}`,
      data: { products: active },
    };
  }

  private static handleViewChannels(channels: Array<{ id: string; type: string; name?: string; is_active?: boolean }>, _params: Record<string, string | number | number[] | undefined>): CommandResponse {
    if (!channels || channels.length === 0) {
      return { success: true, message: '❌ لم يتم ربط قنوات' };
    }

    const active = channels.filter(c => c.is_active);
    const summary = active
      .map(c => `✅ ${c.type.toUpperCase()} - ${c.name || c.type}`)
      .join('\n');

    return {
      success: true,
      message: `📡 القنوات المتصلة (${active.length}/${channels.length}):\n\n${summary}`,
      data: { channels: active },
    };
  }

  private static handleViewInventory(products: Product[], _params: Record<string, string | number | number[] | undefined>): CommandResponse {
    const lowStock = products.filter(p => (p.stock || 0) < 5 && p.status === 'active');
    
    if (lowStock.length === 0) {
      return { success: true, message: '✅ جميع المنتجات كافية المخزون' };
    }

    const summary = lowStock
      .slice(0, 10)
      .map((p, i) => `${i + 1}. ${p.name} - ${p.stock || 0} قطع`)
      .join('\n');

    return {
      success: true,
      message: `⚠️ منتجات قليلة المخزون (${lowStock.length}):\n\n${summary}\n\n💡 التوصية: أطلب مخزون إضافي قريباً`,
      data: { products: lowStock },
    };
  }

  /**
   * توليد نص نظام prompt محسّن
   */
  static buildSmartPrompt(config: {
    merchantName?: string;
    productsCount: number;
    ordersCount: number;
    channelsCount: number;
    lastActions?: string[];
  }): string {
    return `أنت وكيل ذكي متقدم لمتجر "${config.merchantName || 'المتجر'}".

### الحالة الحالية:
- إجمالي المنتجات: ${config.productsCount}
- الطلبات النشطة: ${config.ordersCount}
- القنوات المتصلة: ${config.channelsCount}
${config.lastActions ? `- آخر الإجراءات: ${config.lastActions.slice(-3).join(' → ')}` : ''}

### المسؤوليات الرئيسية:
1. فهم الأوامر الطبيعية بالعربية (محكية وفصحى)
2. عرض البيانات والإحصائيات بشكل منظم وواضح
3. إدارة الطلبات والمنتجات والقنوات
4. إرسال رسائل فورية عبر القنوات المختلفة
5. جدولة المهام المتكررة (يومية، أسبوعية، شهرية)
6. تقديم توصيات ذكية لتحسين الأداء

### طريقة التواصل:
- استجب بروح احترافية وودية
- اطلب تأكيد قبل أي عملية حساسة (إرسال، حذف، تعديل)
- استخدم emoji مناسبة للتوضيح
- قدّم البيانات بجداول منظمة عند الحاجة
- تذكّر الأوامر المتكررة واقترح أتمتتها

ركّز على الكفاءة والأمان والتطبيق الدقيق للأوامر.`;
  }
}
