// han in 輸入記帳：保單截圖辨識（在手機上用 Tesseract 讀字，不上傳任何地方）
// parsePolicyText：把辨識出的文字整理成保單欄位
(function (root) {
  'use strict';
  const INSURERS = ['國泰人壽', '富邦人壽', '南山人壽', '新光人壽', '台灣人壽', '中國人壽', '全球人壽', '三商美邦人壽', '遠雄人壽', '安聯人壽', '保誠人壽', '宏泰人壽', '元大人壽', '合作金庫人壽', '第一金人壽', '臺銀人壽', '台銀人壽', '友邦人壽', '法國巴黎人壽', '凱基人壽', '安達人壽', '台新人壽', '新光產險', '國泰產險', '富邦產險', '新安東京海上產險', '和泰產險', '明台產險', '旺旺友聯產險', '兆豐產險', '泰安產險', '第一產險', '南山產物', '中華郵政'];
  const CJK = '\\u3400-\\u9fff';

  /** 整理 OCR 文字：全形轉半形、拿掉中文字之間多出來的空白 */
  function normalize(text) {
    let t = String(text || '').normalize('NFKC').replace(/\r/g, '');
    t = t.replace(/[：﹕]/g, ':').replace(/[，]/g, ',').replace(/[／]/g, '/');
    for (let i = 0; i < 3; i++) t = t.replace(new RegExp(`([${CJK}])[ \\t]+([${CJK}])`, 'g'), '$1$2');
    t = t.replace(new RegExp(`([${CJK}])[ \\t]+(\\d)`, 'g'), '$1 $2').replace(new RegExp(`(\\d)[ \\t]+([${CJK}])`, 'g'), '$1 $2');
    t = t.replace(/(\d),\s+(\d{3})/g, '$1,$2');
    t = t.replace(/臺/g, '台').replace(/[邁蠆薑萬]繳/g, '躉繳');
    return t.split('\n').map(l => l.trim()).filter(Boolean);
  }

  /** "100 萬元" → 1000000；"32,580 元" → 32580；"USD 12,345.6" → 12345.6 */
  function money(s) {
    if (!s) return null;
    const m = String(s).match(/(\d[\d,]*(?:\.\d+)?)\s*(萬)?/);
    if (!m) return null;
    let v = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(v)) return null;
    if (m[2]) v *= 10000;
    return Math.round(v * 100) / 100;
  }

  /** 找某個標籤後面的值（同一行；同一行沒有就看下一行） */
  function after(lines, re, valRe) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (!m) continue;
      const rest = lines[i].slice(m.index + m[0].length).replace(/^[:\s]+/, '');
      const v = rest.match(valRe);
      if (v) return v[1] ?? v[0];
      const next = lines[i + 1] && lines[i + 1].match(valRe);
      if (next && !rest) return next[1] ?? next[0];
    }
    return null;
  }
  const NUM = /(\d[\d,]*(?:\.\d+)?\s*萬?)/;
  const NAME = new RegExp(`^([${CJK}‧·]{2,5})`);

  function typeOf(name) {
    const n = name || '';
    if (/投資|變額|萬能|連結/.test(n)) return '投資型';
    if (/年金/.test(n)) return '年金';
    if (/長照|長期照顧/.test(n)) return '長照';
    if (/失能|殘扶/.test(n)) return '失能';
    if (/重大疾病|重大傷病|癌症|防癌/.test(n)) return '重大疾病';
    if (/醫療|住院|手術|實支/.test(n)) return '醫療';
    if (/意外|傷害/.test(n)) return '意外';
    if (/還本|儲蓄|增額|利率變動|美利|添利|富利/.test(n)) return '儲蓄';
    if (/壽險|壽/.test(n)) return '壽險';
    return null;
  }

  function parsePolicyText(text) {
    const lines = normalize(text);
    const all = lines.join('\n');
    const r = {};
    r.insurer = INSURERS.find(n => all.includes(n.replace(/臺/g, '台'))) || (all.match(new RegExp(`([${CJK}]{2,6}(?:人壽|產險|產物))`)) || [])[1] || null;
    const cutName = (n) => n ? n.split(/被保|要保|性別|生日|身分|年齡|關係/)[0] || null : null;
    r.holder = cutName(after(lines, /要保人(?:姓名)?/, NAME));
    r.insured = cutName(after(lines, /被保(?:險)?人(?:姓名)?/, NAME));
    const nm = after(lines, /(?:保單|商品|險種|主約|契約)名稱/, new RegExp(`([${CJK}A-Za-z0-9()（）]{3,30})`));
    r.policy_name = nm || (lines.find(l => new RegExp(`^[${CJK}A-Za-z0-9()（）]{3,30}(?:壽險|保險|醫療險|險)$`).test(l) && !/要保|被保|狀態|保費|保額|價值|解約/.test(l)) || null);
    const curTxt = after(lines, /幣別/, new RegExp(`([${CJK}A-Z]{2,4})`)) || all;
    r.currency = /美元|美金|USD/.test(curTxt) ? 'USD' : /澳幣|AUD/.test(curTxt) ? 'AUD' : /人民幣|CNY|RMB/.test(curTxt) ? 'CNY' : 'TWD';
    r.sum_assured = money(after(lines, /(?:主約)?(?:保險金額|保額)(?!增)/, NUM));
    // 每期保費：有「保費」但不是已繳／累計的那一行
    for (const l of lines) {
      if (!/保費|保險費/.test(l) || /已繳|累計|總繳|繳費年期|豁免|退還|保費總額/.test(l)) continue;
      const v = money((l.split(/保險?費/).slice(1).join(' ').match(NUM) || [])[1]);
      if (v) { r.premium = v; break; }
    }
    const per = after(lines, /繳別|繳費方式|繳法|繳費別/, /(躉繳|年繳|半年繳|季繳|月繳)/) || (all.match(/(躉繳|半年繳|年繳|季繳|月繳)/) || [])[1];
    r.premium_period = per || null;
    const yrs = after(lines, /繳費年期|繳費期間|繳費年限/, /(\d{1,2})/) || (all.match(/(\d{1,2})\s*年期/) || [])[1];
    r.pay_years = yrs ? Number(yrs) : (r.premium_period === '躉繳' ? 1 : null);
    r.paid_total = money(after(lines, /(?:累計|已繳|總繳)(?:保費|保險費)(?:總額)?|已繳保費/, NUM));
    r.cash_value = money(after(lines, /解約金|解約價值/, NUM)) ?? money(after(lines, /保單價值準備金|保價金/, NUM)) ?? money(after(lines, /保單帳戶價值|帳戶價值/, NUM));
    const d = after(lines, /生效日|契約始期|投保日|承保日|保單生效/, /(\d{2,4})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})/);
    if (d) {
      const m = all.match(/(?:生效日|契約始期|投保日|承保日|保單生效)[^\d\n]*(\d{2,4})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})/);
      if (m) { let y = Number(m[1]); if (y < 200) y += 1911; r.start_date = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`; }
    }
    r.policy_type = typeOf(r.policy_name || all);
    const found = Object.entries(r).filter(([k, v]) => v != null && v !== '' && !(k === 'currency' && v === 'TWD')).map(([k]) => k);
    return { fields: r, found, lines };
  }

  const api = { parsePolicyText, normalize, money };
  if (typeof module !== 'undefined') module.exports = api; else root.HanPolicyOCR = api;
})(typeof window !== 'undefined' ? window : globalThis);
