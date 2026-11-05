// han in 輸入記帳：雲端資料層
// 1. 帳號（註冊、登入、登出、忘記密碼、刪除帳號）
// 2. CloudDB：和原本 LocalDB 相同的介面（collection / doc / where / onSnapshot），
//    先寫進手機快取（離線也能記帳），再同步到 Supabase；其他裝置的變更即時推送回來。
window.HanCloud = (() => {
  'use strict';
  const cfg = window.HANIN_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co$/.test(cfg.url || '') && (cfg.anonKey || '').length >= 20 && !/貼上/.test(cfg.anonKey);
  const C = window.Capacitor, isNative = !!(C && C.isNativePlatform && C.isNativePlatform());
  const Prefs = isNative ? ((C.Plugins && C.Plugins.Preferences) || (C.registerPlugin && C.registerPlugin('Preferences'))) : null;

  // 手機上用 Preferences（不會被系統清掉），瀏覽器用 localStorage
  const kv = {
    async get(k) { try { if (Prefs) { const r = await Prefs.get({ key: k }); return r ? r.value : null; } return localStorage.getItem(k); } catch { return null; } },
    async set(k, v) { try { if (Prefs) await Prefs.set({ key: k, value: v }); else localStorage.setItem(k, v); } catch (e) { console.error(e); } },
    async del(k) { try { if (Prefs) await Prefs.remove({ key: k }); else localStorage.removeItem(k); } catch {} },
  };

  const sb = configured ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative, storage: { getItem: kv.get, setItem: kv.set, removeItem: kv.del } },
  }) : null;

  // ---------- 帳號 ----------
  const errText = (e) => {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'Email 或密碼不對';
    if (/Email not confirmed/i.test(m)) return '還沒完成 Email 驗證，請到信箱點驗證連結';
    if (/already registered|already been registered/i.test(m)) return '這個 Email 已經註冊過，請直接登入';
    if (/Password should be at least|weak/i.test(m)) return '密碼太短或太簡單，至少 8 個字元、要有英文和數字';
    if (/rate limit|too many/i.test(m)) return '嘗試太多次，請稍後再試';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return '連不上網路，請檢查連線';
    return m || '發生錯誤，請再試一次';
  };
  const auth = {
    configured,
    async session() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session; },
    onChange(cb) { if (sb) sb.auth.onAuthStateChange((ev, s) => cb(ev, s)); },
    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw new Error(errText(error));
      return { needConfirm: !data.session };
    },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(errText(error)); },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email); if (error) throw new Error(errText(error)); },
    async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(errText(error)); },
    async deleteAccount(uid) {
      const { error } = await sb.rpc('delete_my_account'); if (error) throw new Error(errText(error));
      await kv.del('hanin-cloud-' + uid); await sb.auth.signOut();
    },
    async profile(uid) { const { data } = await sb.from('profiles').select('display_name,is_admin').eq('id', uid).maybeSingle(); return data || {}; },
    errText,
  };

  // ---------- 雲端文件資料庫 ----------
  function openDB(uid, onSync) {
    const KEY = 'hanin-cloud-' + uid;
    let store = {}, pending = {}; const listeners = new Set();
    let flushing = false, again = false, online = true, channel = null, retryT = null, persistT = null;
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    const persist = () => { clearTimeout(persistT); persistT = setTimeout(() => kv.set(KEY, JSON.stringify({ store, pending })), 80); };
    const report = () => onSync && onSync({ online, pending: Object.keys(pending).length });

    async function flush() {
      if (flushing) { again = true; return; }
      flushing = true;
      try {
        do {
          again = false;
          const entries = Object.entries(pending);
          if (!entries.length) break;
          const ups = entries.filter(([, v]) => v !== null), dels = entries.filter(([, v]) => v === null).map(([p]) => p);
          for (let i = 0; i < ups.length; i += 200) {
            const chunk = ups.slice(i, i + 200);
            const { error } = await sb.from('user_docs').upsert(chunk.map(([path, data]) => ({ user_id: uid, path, data })), { onConflict: 'user_id,path' });
            if (error) throw error;
            for (const [p, d] of chunk) if (pending[p] === d) delete pending[p];
          }
          for (let i = 0; i < dels.length; i += 200) {
            const chunk = dels.slice(i, i + 200);
            const { error } = await sb.from('user_docs').delete().eq('user_id', uid).in('path', chunk);
            if (error) throw error;
            for (const p of chunk) if (pending[p] === null) delete pending[p];
          }
          persist();
        } while (again);
        online = true;
      } catch (e) {
        console.warn('同步失敗，稍後重試', e);
        online = false;
        clearTimeout(retryT); retryT = setTimeout(flush, 15000);
      } finally { flushing = false; report(); }
    }

    function write(path, data) {
      if (data === null) delete store[path]; else store[path] = clone(data);
      pending[path] = data === null ? null : store[path];
      persist(); emit(); report(); flush();
    }

    async function pull() {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('user_docs').select('path,data').eq('user_id', uid).range(from, from + 999);
        if (error) throw error;
        rows.push(...data); if (data.length < 1000) break;
      }
      const server = {}; for (const r of rows) server[r.path] = r.data;
      for (const p of Object.keys(store)) if (!(p in server) && !(p in pending)) delete store[p];
      for (const [p, d] of Object.entries(server)) if (!(p in pending)) store[p] = d;
      persist(); emit();
    }

    function listen() {
      channel = sb.channel('docs-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_docs', filter: 'user_id=eq.' + uid }, (pl) => {
          const path = (pl.new && pl.new.path) || (pl.old && pl.old.path);
          if (!path || path in pending) return;
          if (pl.eventType === 'DELETE') delete store[path]; else store[path] = pl.new.data;
          persist(); emit();
        })
        .subscribe((st) => { if (st === 'SUBSCRIBED') pull().catch(() => {}); });
    }

    const ready = (async () => {
      try { const raw = await kv.get(KEY); if (raw) { const o = JSON.parse(raw); store = o.store || {}; pending = o.pending || {}; } } catch {}
      emit();
      try { await pull(); online = true; } catch (e) { online = false; console.warn('先用手機裡的資料', e); }
      report(); flush(); listen();
      window.addEventListener('online', () => { flush(); pull().catch(() => {}); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); pull().catch(() => {}); } });
    })();

    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const snapDoc = (path) => ({ id: path.split('/').pop(), exists: Object.prototype.hasOwnProperty.call(store, path), data: () => store[path], metadata: { fromCache: false, hasPendingWrites: path in pending } });
    const docRef = (path) => ({
      id: path.split('/').pop(), path,
      get: async () => snapDoc(path),
      set: async (d) => write(path, d),
      update: async (d) => { if (!store[path]) throw { code: 'invalid_argument' }; write(path, { ...store[path], ...clone(d) }); },
      delete: async () => write(path, null),
      onSnapshot: (next) => { const run = () => next(snapDoc(path)); listeners.add(run); setTimeout(run, 0); return () => listeners.delete(run); },
    });
    const test = (v, op, x) => op === '==' ? v === x : op === '!=' ? v !== x : op === '<' ? v < x : op === '<=' ? v <= x : op === '>' ? v > x : op === '>=' ? v >= x : true;
    const query = (coll, filters = []) => {
      const depth = coll.split('/').length + 1;
      const docs = () => Object.keys(store).filter(p => p.startsWith(coll + '/') && p.split('/').length === depth).map(snapDoc).filter(d => filters.every(([f, op, x]) => test((d.data() || {})[f], op, x)));
      return {
        where: (f, op, x) => query(coll, [...filters, [f, op, x]]), orderBy() { return this; }, limit() { return this; },
        get: async () => { const d = docs(); return { docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false } }; },
        onSnapshot: (next) => { const run = () => { const d = docs(); next({ docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false }, docChanges: () => [] }); }; listeners.add(run); setTimeout(run, 0); return () => listeners.delete(run); },
        doc: (id) => docRef(coll + '/' + (id || newId())),
        add: async (d) => { const r = docRef(coll + '/' + newId()); await r.set(d); return r; },
      };
    };
    return {
      ready, collection: (c) => query(c), doc: (p) => docRef(p), dump: () => clone(store),
      replaceAll(obj) {
        const next = clone(obj);
        for (const p of Object.keys(store)) if (!(p in next)) pending[p] = null;
        for (const [p, d] of Object.entries(next)) pending[p] = d;
        store = next; persist(); emit(); report(); flush();
      },
      close() { listeners.clear(); clearTimeout(retryT); if (channel) sb.removeChannel(channel); },
      syncNow() { flush(); return pull(); },
    };
  }

  // ---------- 公開資料與 AI ----------
  async function loadCatalog() {
    const cacheKey = 'hanin-catalog-v1';
    try {
      const [b, c] = await Promise.all([
        sb.from('banks').select('id,name').eq('active', true).order('code', { nullsFirst: false }),
        sb.from('cards').select('id,bank_id,name,annual_fee,active,last_checked_at,card_rewards(id,channel,channel_tags,rate,cap_amount,cap_period,min_spend,conditions,valid_from,valid_to,source_url,updated_at)').eq('active', true),
      ]);
      if (b.error || c.error) throw b.error || c.error;
      const cat = { banks: b.data, cards: c.data, at: Date.now() };
      kv.set(cacheKey, JSON.stringify(cat));
      return cat;
    } catch (e) {
      const raw = await kv.get(cacheKey); if (raw) return JSON.parse(raw);
      throw e;
    }
  }
  async function analyzePolicy(images, me) {
    const { data, error } = await sb.functions.invoke('analyze-policy', { body: { images, consent: true, me } });
    if (error) {
      let msg = '辨識失敗，請稍後再試';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return data.result;
  }
  const admin = {
    async pending() {
      const { data, error } = await sb.from('reward_changes').select('id,kind,bank_id,card_id,proposed,current,source_url,created_at,banks(name)').eq('status', 'pending').order('created_at');
      if (error) throw error; return data;
    },
    async approve(id) { const { error } = await sb.rpc('approve_reward_change', { change_id: id }); if (error) throw error; },
    async reject(id, uid) { const { error } = await sb.from('reward_changes').update({ status: 'rejected', reviewed_by: uid, reviewed_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
    async banks() { const { data, error } = await sb.from('banks').select('id,code,name,domain,card_list_url,last_run_at,last_run_status,active').order('code', { nullsFirst: false }); if (error) throw error; return data; },
    async updateBank(id, patch) { const { error } = await sb.from('banks').update(patch).eq('id', id); if (error) throw error; },
    async cardsOfBank(bankId) {
      const { data, error } = await sb.from('cards').select('id,bank_id,name,annual_fee,source_url,active,card_rewards(id,channel,channel_tags,rate,cap_amount,cap_period,min_spend,conditions,valid_from,valid_to)').eq('bank_id', bankId).order('name');
      if (error) throw error; return data;
    },
    async saveCard(card, rules) { const { data, error } = await sb.rpc('admin_save_card', { card, rules }); if (error) throw new Error(error.message); return data; },
    async deleteCard(id) { const { error } = await sb.rpc('admin_delete_card', { card_id: id }); if (error) throw new Error(error.message); },
  };

  // AI 功能（保單截圖、回饋自動更新）要在 config.js 設 ai: true 才會出現
  const aiEnabled = !!cfg.ai;
  return { sb, auth, openDB, loadCatalog, analyzePolicy, admin, isNative, aiEnabled };
})();
