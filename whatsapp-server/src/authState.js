// ─────────────────────────────────────────────────────────────────────────────
// تخزين جلسة واتساب (Multi-Device Auth State) داخل قاعدة البيانات.
//
// ليش مو useMultiFileAuthState الجاهزة؟
// لأنها بتخزّن الجلسة بملفات على قرص السيرفر. على Railway/Docker القرص مؤقت،
// فأول ما يعيد السيرفر التشغيل أو ينعمل deploy جديد → تضيع الجلسة ويضطر
// الزبون يمسح QR من جديد كل مرة. هون منخزّن كل شي بـ Supabase، فالجلسة
// بتضل محفوظة للأبد ومنرجع نتصل تلقائيًا بدون أي تدخل من الزبون.
// ─────────────────────────────────────────────────────────────────────────────
import { initAuthCreds, BufferJSON, proto } from 'baileys';
import { supabase } from './supabase.js';
import { logError } from './logger.js';

const TABLE = 'whatsapp_auth_state';

// jsonb ما بيعرف Buffer، فمنحوّل عبر replacer/reviver تبع baileys.
function encode(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}
function decode(value) {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

export async function useSupabaseAuthState(channelId) {
  const cache = new Map();

  async function readData(key) {
    if (cache.has(key)) return cache.get(key);
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('channel_id', channelId)
      .eq('key', key)
      .maybeSingle();
    if (error) {
      logError('auth-state', `فشل قراءة ${key}`, error);
      return null;
    }
    const value = decode(data?.value ?? null);
    cache.set(key, value);
    return value;
  }

  async function writeMany(entries) {
    if (!entries.length) return;
    const rows = entries.map(([key, value]) => {
      cache.set(key, value);
      return { channel_id: channelId, key, value: encode(value), updated_at: new Date().toISOString() };
    });
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'channel_id,key' });
    if (error) logError('auth-state', 'فشل حفظ مفاتيح الجلسة', error);
  }

  async function removeMany(keys) {
    if (!keys.length) return;
    for (const key of keys) cache.delete(key);
    const { error } = await supabase.from(TABLE).delete().eq('channel_id', channelId).in('key', keys);
    if (error) logError('auth-state', 'فشل حذف مفاتيح الجلسة', error);
  }

  const creds = (await readData('creds')) || initAuthCreds();

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const result = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) result[id] = value;
          })
        );
        return result;
      },
      set: async (data) => {
        const toWrite = [];
        const toRemove = [];
        for (const type of Object.keys(data)) {
          for (const id of Object.keys(data[type] ?? {})) {
            const value = data[type][id];
            const key = `${type}-${id}`;
            if (value) toWrite.push([key, value]);
            else toRemove.push(key);
          }
        }
        await Promise.all([writeMany(toWrite), removeMany(toRemove)]);
      },
    },
  };

  return {
    state,
    // baileys بينادي saveCreds بعد كل تغيير مهم — أي فشل هون معناه ضياع الجلسة
    // بعد إعادة التشغيل، فمنسجّله بوضوح.
    saveCreds: async () => {
      await writeMany([['creds', state.creds]]);
    },
    // نمسح الجلسة كاملة (تسجيل خروج / رفض من واتساب) حتى يبدأ ربط جديد نظيف.
    clearAuthState: async () => {
      cache.clear();
      const { error } = await supabase.from(TABLE).delete().eq('channel_id', channelId);
      if (error) logError('auth-state', 'فشل مسح الجلسة', error);
    },
  };
}
