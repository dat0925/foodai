# Edge Function セットアップ手順

## 1. Supabase に Secrets を登録

以下のURLを開く：
https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/settings/vault

「New secret」を5回繰り返して以下を登録：

| Name | Value |
|------|-------|
| `LINE_CHANNEL_SECRET` | （LINEのChannel Secret） |
| `LINE_CHANNEL_ACCESS_TOKEN` | （LINEのChannel Access Token） |
| `ANTHROPIC_API_KEY` | （Claude APIキー） |
| `FOODAI_SHOP_ID` | `a1b2c3d4-0000-0000-0000-000000000001` |

※ `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はEdge Functionsに自動で入ります。

---

## 2. Edge Function をデプロイ

以下のURLを開く：
https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/functions

1. 「Deploy a new function」をクリック
2. Function name: `line-webhook`
3. `supabase/functions/line-webhook/index.ts` の内容をエディタに貼り付け
4. 「Deploy」

デプロイ後、以下のURLがWebhook URLになります：
```
https://sfhtvtcmgueystyuhzvd.supabase.co/functions/v1/line-webhook
```

---

## 3. LINE Developers にWebhook URLを設定

1. https://developers.line.biz/console/ を開く
2. 作成したチャンネル → Messaging API設定
3. Webhook URL に上記URLを貼り付け
4. 「検証」ボタンで確認
5. 「Webhookの利用」をONにする

---

## 4. 動作確認

LINE公式アカウントに友だち追加して「予約したい」と送信。
