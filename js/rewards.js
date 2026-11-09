// han in 輸入記帳：刷哪張卡最划算
// 標籤清單要和 supabase/functions/_shared/tags.ts 一致。
(function (root) {
  'use strict';
  // 每個通路標籤對應的關鍵字（比對備註）與記帳分類
  const TAGS = {
    domestic: { k: [], c: [] },
    overseas: { k: ['海外', '國外', '出國', 'amazon', 'agoda'], c: ['旅遊'] },
    japan: { k: ['日本', '東京', '大阪', '京都', '沖繩', '北海道', '福岡', 'japan'], c: [] },
    korea: { k: ['韓國', '首爾', '釜山', 'korea'], c: [] },
    online: { k: ['網購', '網路購物', '線上'], c: [] },
    shopee: { k: ['蝦皮', 'shopee'], c: [] },
    momo: { k: ['momo', '富邦媒'], c: [] },
    pchome: { k: ['pchome', '24h'], c: [] },
    coupang: { k: ['酷澎', 'coupang'], c: [] },
    yahoo: { k: ['yahoo', '奇摩'], c: [] },
    linepay: { k: [], c: [], via: 'LINE Pay' },
    jkopay: { k: ['街口'], c: [] },
    pxpay: { k: [], c: [], via: '全支付' },
    applepay: { k: [], c: [], via: 'Apple Pay' },
    googlepay: { k: ['google pay'], c: [] },
    samsungpay: { k: ['samsung pay'], c: [] },
    ipass_money: { k: ['ipass money', '一卡通money'], c: [] },
    easywallet: { k: ['悠遊付'], c: [] },
    convenience: { k: ['7-11', '711', '統一超商', '全家', '萊爾富', 'ok超商', '超商'], c: [] },
    supermarket: { k: ['全聯', '家樂福', '好市多', 'costco', '大全聯', '美廉社', '愛買', '超市'], c: ['日用品'] },
    department: { k: ['百貨', '新光三越', 'sogo', '遠百', '微風', '漢神', '統一時代', '週年慶'], c: [] },
    dining: { k: ['餐廳', '午餐', '晚餐', '早餐', '火鍋', '燒肉', '拉麵', '麥當勞', '肯德基', '摩斯'], c: ['餐飲'] },
    delivery: { k: ['uber eats', 'ubereats', 'foodpanda', '熊貓', '外送'], c: [] },
    uber: { k: ['uber', '小黃', '計程車', '55688'], c: [] },
    transport: { k: ['高鐵', '台鐵', '捷運', '客運', '悠遊卡', '一卡通', '公車'], c: ['交通'] },
    gas: { k: ['加油', '中油', '台塑石油', '全國加油'], c: [] },
    ev_charging: { k: ['充電', 'tesla', 'u-power', 'ycs'], c: [] },
    parking: { k: ['停車'], c: [] },
    travel_booking: { k: ['agoda', 'booking', 'klook', 'kkday', 'hotels.com', 'expedia', 'trip.com', '易遊網', '雄獅', '可樂旅遊'], c: [] },
    airline: { k: ['機票', '長榮航空', '華航', '星宇', '虎航', '航空'], c: [] },
    hotel: { k: ['飯店', '酒店', '住宿', '民宿', '旅館'], c: [] },
    streaming: { k: ['netflix', 'disney', 'spotify', 'youtube', 'kkbox', 'apple music', 'friday影音', 'myvideo', 'hbo'], c: [] },
    ai_subscription: { k: ['chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'copilot', 'midjourney', 'perplexity'], c: [] },
    app_store: { k: ['app store', 'apple.com', 'icloud', 'google play'], c: [] },
    gaming: { k: ['steam', 'playstation', 'switch', 'nintendo', 'xbox', '遊戲'], c: [] },
    telecom: { k: ['中華電信', '台灣大哥大', '遠傳', '電話費', '手機費', '網路費'], c: ['通訊'] },
    utilities: { k: ['電費', '水費', '瓦斯', '台電'], c: [] },
    insurance: { k: ['保費', '保險'], c: ['保費'] },
    tax: { k: ['繳稅', '所得稅', '牌照稅', '燃料稅', '地價稅', '房屋稅'], c: [] },
    tuition: { k: ['學費', '學雜費'], c: ['學習'] },
    medical: { k: ['醫院', '診所', '掛號', '牙醫'], c: ['醫療'] },
    pharmacy: { k: ['屈臣氏', '康是美', '寶雅', '藥局', '藥妝'], c: ['美容'] },
    bookstore: { k: ['誠品', '博客來', '金石堂', '書店'], c: [] },
    cinema: { k: ['電影', '威秀', '秀泰', '國賓'], c: [] },
    pet: { k: ['寵物', '貓砂', '飼料'], c: [] },
    home: { k: ['ikea', '特力屋', 'hola', '宜得利', 'nitori'], c: [] },
    electronics: { k: ['燦坤', '全國電子', '順發', 'apple store', '3c'], c: [] },
    coffee: { k: ['星巴克', 'starbucks', '路易莎', 'cama', '咖啡'], c: [] },
    drinks: { k: ['50嵐', '清心', '可不可', '迷客夏', '麻古', '珍奶', '手搖'], c: ['飲料'] },
    fashion: { k: ['uniqlo', 'zara', 'gu', 'h&m', 'net'], c: [] },
    sports: { k: ['健身', 'world gym', '迪卡儂', 'decathlon'], c: ['運動'] },
    charity: { k: ['捐款'], c: [] },
  };

  const LABELS = {
    domestic: '國內一般消費',
    overseas: '海外消費（含國外網站）',
    japan: '日本消費',
    korea: '韓國消費',
    online: '國內網購（一般）',
    shopee: '蝦皮',
    momo: 'momo',
    pchome: 'PChome',
    coupang: '酷澎',
    yahoo: 'Yahoo購物',
    linepay: 'LINE Pay',
    jkopay: '街口支付',
    pxpay: '全支付',
    applepay: 'Apple Pay',
    googlepay: 'Google Pay',
    samsungpay: 'Samsung Pay',
    ipass_money: 'iPASS MONEY',
    easywallet: '悠遊付',
    convenience: '超商（7-11、全家、萊爾富、OK）',
    supermarket: '超市量販（全聯、家樂福、好市多等）',
    department: '百貨公司',
    dining: '餐廳',
    delivery: '外送（Uber Eats、foodpanda）',
    uber: 'Uber 叫車',
    transport: '交通（高鐵、台鐵、捷運、客運）',
    gas: '加油',
    ev_charging: '電動車充電',
    parking: '停車',
    travel_booking: '訂房訂票網站（Agoda、Booking、Klook 等）',
    airline: '航空公司',
    hotel: '飯店',
    streaming: '影音串流（Netflix、Disney+、Spotify、YouTube）',
    ai_subscription: 'AI 訂閱（ChatGPT、Claude 等）',
    app_store: 'Apple / Google 應用程式商店',
    gaming: '遊戲',
    telecom: '電信費',
    utilities: '水電瓦斯',
    insurance: '保費',
    tax: '繳稅',
    tuition: '學費',
    medical: '醫療',
    pharmacy: '藥妝（屈臣氏、康是美）',
    bookstore: '書店',
    cinema: '電影院',
    pet: '寵物',
    home: '家居（IKEA、特力屋）',
    electronics: '3C 家電',
    coffee: '咖啡',
    drinks: '手搖飲',
    fashion: '服飾',
    sports: '運動',
    charity: '公益捐款',
  };

  /** 從一筆消費猜出通路標籤 */
  function tagsFor({ note = '', category = '', via = '' }) {
    const text = String(note).toLowerCase();
    const out = new Set();
    for (const [tag, d] of Object.entries(TAGS)) {
      if (d.via && d.via === via) out.add(tag);
      if (d.k.some(w => w && text.includes(w))) out.add(tag);
      if (d.c.includes(category)) out.add(tag);
    }
    // 判斷是不是海外：有出現日韓就算海外
    if (out.has('japan') || out.has('korea')) out.add('overseas');
    if (!out.has('overseas')) out.add('domestic');
    if (['shopee', 'momo', 'pchome', 'coupang', 'yahoo'].some(t => out.has(t))) out.add('online');
    return out;
  }

  const periodStart = (period, date) => {
    const [y, m] = date.split('-').map(Number);
    if (period === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
    if (period === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
    if (period === 'year') return `${y}-01-01`;
    return null;
  };
  const active = (r, date) => (!r.valid_from || r.valid_from <= date) && (!r.valid_to || r.valid_to >= date);

  /** 一張卡對某筆消費最適用的規則：沒有標籤的規則適用所有消費，有標籤的要符合其中一個；取回饋最高的 */
  /** 這張卡有哪些可切換的權益方案 */
  function plansOf(card) { return [...new Set((card.card_rewards || []).map(r => r.plan).filter(Boolean))]; }
  /** plan：使用者目前切到的方案；undefined＝不管方案（找所有方案裡最好的） */
  function bestRule(card, tags, date, plan) {
    let best = null;
    for (const r of card.card_rewards || []) {
      if (!active(r, date)) continue;
      if (plan !== undefined && r.plan && r.plan !== plan) continue;
      const need = r.channel_tags || [];
      if (need.length && !need.some(t => tags.has(t))) continue;
      if (!best || Number(r.rate) > Number(best.rate)) best = r;
    }
    return best;
  }

  /** 估算這條規則在目前週期已經拿到多少回饋 */
  function usedReward(rule, account, txns, date, card, plan) {
    if (!rule.cap_amount) return 0;
    const from = rule.cap_period === 'campaign' ? (rule.valid_from || '0000') : periodStart(rule.cap_period || 'month', date);
    let used = 0;
    for (const t of txns) {
      if (t.type !== 'expense' || t.account !== account || !t.date || t.date < from || t.date > date) continue;
      const r = bestRule(card, tagsFor({ note: t.note, category: t.category, via: t.via }), t.date, plan);
      if (r && r.id === rule.id) used += Number(t.amount) * Number(rule.rate) / 100;
    }
    return Math.min(used, rule.cap_amount);
  }

  /**
   * 推薦要刷哪張卡
   * @param {object} p { amount, note, category, via, date, accounts(使用者的信用卡帳戶，含 cardId), cards(Map id→卡片資料), txns }
   * @returns 由高到低排序的 [{ account, card, rule, rate, reward, capLeft }]
   */
  function recommend(p) {
    const tags = tagsFor(p), date = p.date, amt = Number(p.amount) || 0;
    const out = [];
    for (const acc of p.accounts) {
      const card = acc.cardId && p.cards.get(acc.cardId);
      if (!card) continue;
      // 有方案的卡：只用目前切到的方案（沒設定＝只算不分方案的規則），另外提示「切換到哪個方案更划算」
      const plans = plansOf(card), plan = plans.length ? (acc.cardPlan || null) : undefined;
      const rule = bestRule(card, tags, date, plan);
      const alt = plans.length ? bestRule(card, tags, date) : null;
      const switchTo = alt && alt.plan && alt.plan !== plan && Number(alt.rate) > Number(rule ? rule.rate : 0) ? { plan: alt.plan, rate: Number(alt.rate), rule: alt } : null;
      if (!rule) { out.push({ account: acc, card, rule: null, rate: 0, reward: 0, capLeft: null, switchTo }); continue; }
      if (rule.min_spend && amt && amt < rule.min_spend) { out.push({ account: acc, card, rule, rate: 0, reward: 0, capLeft: null, belowMin: true }); continue; }
      const capLeft = rule.cap_amount ? Math.max(0, rule.cap_amount - usedReward(rule, acc.id, p.txns, date, card, plan)) : null;
      let reward = amt * Number(rule.rate) / 100;
      if (capLeft !== null && reward > capLeft) {
        // 超過上限的部分改用這張卡其他沒上限的規則（通常是一般消費回饋）
        const over = amt - capLeft / (Number(rule.rate) / 100);
        const fb = bestRule({ card_rewards: (card.card_rewards || []).filter(r => r.id !== rule.id && !r.cap_amount) }, tags, date, plan);
        reward = capLeft + (fb ? over * Number(fb.rate) / 100 : 0);
      }
      const effRate = amt ? reward / amt * 100 : (capLeft === 0 ? 0 : Number(rule.rate));
      out.push({ account: acc, card, rule, rate: effRate, reward, capLeft, switchTo });
    }
    return out.sort((a, b) => b.rate - a.rate || b.reward - a.reward);
  }

  /**
   * 某個月刷卡拿到的回饋（估算）：每筆用當時切的方案找最適用的規則，並照每條規則的上限扣掉。
   * 回傳 [{ account, card, spend, reward, n }]，依回饋高到低
   */
  function monthRewards({ month, accounts, cards, txns }) {
    const used = new Map(), per = new Map();
    const list = txns.filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === month)
      .slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0));
    for (const t of list) {
      const acc = accounts.find(a => a.id === t.account); if (!acc || !acc.cardId) continue;
      const card = cards.get(acc.cardId); if (!card) continue;
      const plans = plansOf(card), plan = plans.length ? (acc.cardPlan || null) : undefined;
      const amt = Number(t.amount) || 0;
      const row = per.get(acc.id) || { account: acc, card, spend: 0, reward: 0, n: 0 };
      row.spend += amt; row.n++;
      const rule = bestRule(card, tagsFor({ note: t.note, category: t.category, via: t.via }), t.date, plan);
      if (rule) {
        let r = amt * Number(rule.rate) / 100;
        if (rule.cap_amount) {
          const key = acc.id + '|' + rule.id + '|' + (rule.cap_period === 'campaign' ? 'c' : periodStart(rule.cap_period || 'month', t.date));
          const u = used.get(key) || 0; r = Math.max(0, Math.min(r, Number(rule.cap_amount) - u)); used.set(key, u + r);
        }
        row.reward += r;
      }
      per.set(acc.id, row);
    }
    return [...per.values()].sort((a, b) => b.reward - a.reward);
  }

  const api = { TAGS, LABELS, tagsFor, bestRule, usedReward, recommend, plansOf, monthRewards };
  if (typeof module !== 'undefined') module.exports = api; else root.HanRewards = api;
})(typeof window !== 'undefined' ? window : globalThis);
