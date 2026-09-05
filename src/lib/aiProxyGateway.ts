// استخدام نفس الـ AI الموجود عندك عبر ai-proxy في Supabase
// بدل استخدام Claude API خارجي

import { supabase } from './supabase';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIResponse {
  message: string;
  isSuccess: boolean;
  error?: string;
}

class AIProxyGateway {
  private conversationHistory: AIMessage[] = [];
  private provider: string = 'openrouter'; // openai | openrouter | google | huggingface
  private model: string = 'meta-llama/llama-2-70b-chat';
  private apiKey: string = '';

  async initialize(merchantId: string) {
    try {
      // جلب إعدادات الـ AI من قاعدة البيانات
      const { data: aiConfig, error } = await supabase
        .from('ai_configs')
        .select('api_key, provider, model')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (error) {
        throw new Error('فشل في جلب إعدادات الـ AI');
      }

      if (aiConfig) {
        this.apiKey = aiConfig.api_key;
        this.provider = aiConfig.provider || 'openrouter';
        this.model = aiConfig.model || 'meta-llama/llama-2-70b-chat';
      } else {
        throw new Error('لم يتم تكوين الـ AI. يرجى إضافة API Key في الإعدادات.');
      }
    } catch (error) {
      console.error('خطأ في تهيئة AI:', error);
      throw error;
    }
  }

  async sendMessage(userMessage: string): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('API Key غير مُعرّف');
      }

      // إضافة الرسالة للتاريخ
      const userMsg: AIMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      this.conversationHistory.push(userMsg);

      // بناء السياق والـ System Prompt
      const systemPrompt = `أنت وكيل ذكي متقدم لمتجر إلكتروني. 
دورك مساعدة صاحب المتجر في:
- فهم طلباته بدقة عالية
- اقتراح وتنفيذ إجراءات تلقائية
- إدارة قنوات التواصل (WhatsApp, Telegram, Email, Facebook, Instagram)
- إنشاء وتفعيل Workflows
- تحليل البيانات والإحصائيات
- جدولة المهام التلقائية

كن احترافياً وودياً في اللغة العربية.
اطلب تأكيداً قبل أي إجراء حساس.`;

      // استدعاء ai-proxy في Supabase
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          action: 'chat',
          provider: this.provider,
          apiKey: this.apiKey,
          model: this.model,
          systemPrompt,
          userMessage,
        },
      });

      if (error) {
        throw new Error(error.message || 'فشل الاتصال بـ AI');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage = data?.content || 'لم أتمكن من معالجة الطلب';

      // إضافة رد المساعد للتاريخ
      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      };
      this.conversationHistory.push(assistantMsg);

      return {
        message: assistantMessage,
        isSuccess: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      console.error('خطأ في معالجة الرسالة:', errorMsg);
      return {
        message: errorMsg,
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  getConversationHistory(): AIMessage[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  setHistory(messages: AIMessage[]): void {
    this.conversationHistory = messages;
  }

  getCurrentConfig() {
    return {
      provider: this.provider,
      model: this.model,
      hasApiKey: !!this.apiKey,
    };
  }
}

export const aiProxyGateway = new AIProxyGateway();
