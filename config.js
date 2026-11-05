// han in 輸入記帳：雲端資料庫設定
// publishable key 是公開的金鑰，放在這裡是安全的；資料保護靠資料庫的權限設定。
// 絕對不要把 secret key（service_role）或 Anthropic API key 放在這裡。
window.HANIN_CONFIG = {
  url: 'https://ztszcgtmfpfyrstsitxv.supabase.co',
  anonKey: 'sb_publishable_QLJgzAwd_ARLJ-0WJb40XQ_5SLFG1Zt',
  // 免費版維持 false。之後儲值 Anthropic、部署保單辨識函式後再改成 true。
  ai: false,
  // 三餐提醒推播用的公開金鑰（不是秘密）。對應的私鑰放在 Supabase 的 Edge Function Secrets。
  vapidPublicKey: 'BIPjOKW7KClu12K7-_EAd2POEf2N8BBiuuKUqIh-4Nb5em2prF33C2NicdjMVUeUKr3ck6qqYADDsRICQA5RKuc',
};
