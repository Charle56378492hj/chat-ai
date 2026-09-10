// معالجة التخزين والـ Supabase — محسّن
// التحسينات:
//  • معالجة أخطاء أفضل مع رسائل وضيحة
//  • تخزين محلي كنسخة احتياطية عند فشل الاتصال
//  • إعادة محاولة ذكية
//
import { supabase } from './supabase.js';
import { logError, log } from './logger.js';

// تخزين محلي — يُستخدم عند انقطاع Supabase
const localCache = new Map();
const failedWrites = [];

export async function getWhatsAppChannel(channelId) {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('id, merchant_id, name, type, status, config')
      .eq('id', channelId)
      .eq('type', 'whatsapp')
      .maybeSingle();
    
    if (error) {
      throw new Error(`خطأ Supabase: ${error.message}`);
    }
    
    if (data) {
      // حفظ في الذاكرة المحلية
      localCache.set(`channel:${channelId}`, data);
    }
    
    return data ?? null;
  } catch (e) {
    logError('store', `فشل جلب القناة ${channelId}`, e);
    
    // محاولة جلب من التخزين المحلي
    const cached = localCache.get(`channel:${channelId}`);
    if (cached) {
      log('store', `استخدام نسخة محفوظة من القناة ${channelId}`);
      return cached;
    }
    
    return null;
  }
}

// جلب القنوات المراد استرجاعها عند الإقلاع
export async function listResumableChannels() {
  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('channel_id, merchant_id, status, channels!inner(id, type, status)')
      .in('status', ['connected', 'connecting', 'disconnected'])
      .eq('channels.type', 'whatsapp');
    
    if (error) {
      throw new Error(`خطأ Supabase: ${error.message}`);
    }
    
    const result = (data ?? []).map((row) => ({ 
      channelId: row.channel_id, 
      merchantId: row.merchant_id 
    }));
    
    // تخزين محلي
    if (result.length > 0) {
      localCache.set('resumableChannels', result);
    }
    
    return result;
  } catch (e) {
    logError('store', 'فشل جلب الجلسات المحفوظة', e);
    
    // محاولة جلب من التخزين المحلي
    const cached = localCache.get('resumableChannels');
    if (cached) {
      log('store', `استخدام نسخة محفوظة من الجلسات (${cached.length} جلسة)`);
      return cached;
    }
    
    return [];
  }
}

// حفظ حالة الجلسة (مع إعادة محاولة)
export async function saveSessionState(channelId, merchantId, patch) {
  const row = {
    channel_id: channelId,
    merchant_id: merchantId,
    updated_at: new Date().toISOString(),
    ...patch,
  };

  try {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .upsert(row, { onConflict: 'channel_id' });
    
    if (error) {
      throw new Error(`خطأ Upsert: ${error.message}`);
    }
    
    // تسجيل النجاح
    log('store', `حفظ حالة الجلسة ${channelId} — ${patch.status}`);
    
    // حذف من قائمة الكتابات الفاشلة إذا كانت موجودة
    const idx = failedWrites.findIndex(w => w.channelId === channelId);
    if (idx !== -1) failedWrites.splice(idx, 1);
    
  } catch (e) {
    logError('store', `فشل حفظ حالة الجلسة ${channelId}`, e);
    
    // إضافة للقائمة المؤجلة
    failedWrites.push({ channelId, merchantId, patch, timestamp: Date.now() });
    
    // محاولة إعادة الكتابات الفاشلة بعد دقيقة
    setTimeout(() => {
      flushFailedWrites().catch(err => 
        logError('store', 'فشل تفريغ الكتابات المؤجلة', err)
      );
    }, 60_000);
  }
}

// تحديث حالة القناة في جدول channels
export async function setChannelStatus(channelId, status, extraConfig) {
  const patch = { status, last_sync: new Date().toISOString() };
  
  try {
    if (extraConfig) {
      const { data } = await supabase
        .from('channels')
        .select('config')
        .eq('id', channelId)
        .maybeSingle();
      patch.config = { ...(data?.config ?? {}), ...extraConfig };
    }
    
    const { error } = await supabase
      .from('channels')
      .update(patch)
      .eq('id', channelId);
    
    if (error) {
      throw new Error(`خطأ Update: ${error.message}`);
    }
    
    log('store', `تحديث حالة القناة ${channelId} → ${status}`);
    
  } catch (e) {
    logError('store', `فشل تحديث حالة القناة ${channelId}`, e);
    // نحاول بدون توقف الخادم — هذا ليس حرج
  }
}

// إرسال إشعار للتاجر
export async function notify(merchantId, channelId, { level = 'info', title, message, type = 'whatsapp' }) {
  if (!merchantId) return;
  
  try {
    const { error } = await supabase.from('channel_events').insert({
      merchant_id: merchantId,
      channel_id: channelId,
      type,
      level,
      title,
      message,
      created_at: new Date().toISOString(),
    });
    
    if (error) {
      throw new Error(`خطأ Insert: ${error.message}`);
    }
    
    log('notify', `${level.toUpperCase()} — ${title}`);
    
  } catch (e) {
    logError('store', `فشل تسجيل الإشعار للتاجر ${merchantId}`, e);
    // نتابع — الإشعارات ليست حرجة
  }
}

// محاولة تفريغ الكتابات الفاشلة
async function flushFailedWrites() {
  if (failedWrites.length === 0) return;
  
  log('store', `محاولة تفريغ ${failedWrites.length} كتابة مؤجلة…`);
  
  const remaining = [];
  for (const item of failedWrites) {
    try {
      await saveSessionState(item.channelId, item.merchantId, item.patch);
    } catch (e) {
      // إذا استمر الفشل، نبقيها في القائمة
      remaining.push(item);
    }
  }
  
  failedWrites.length = 0;
  failedWrites.push(...remaining);
  
  if (remaining.length > 0) {
    log('store', `${remaining.length} كتابات لم تنجح، سيتم إعادة المحاولة`);
  }
}

// دالة مساعدة للتحقق من الاتصال
export async function checkConnection() {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير معروف' };
  }
}
