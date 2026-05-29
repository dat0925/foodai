# FoodAI 開発引き継ぎドキュメント

> このファイルを読んだClaudeへ：以下を把握した上で開発を継続してください。

---

## プロダクト概要

**FoodAI** — 飲食店専用AIエージェントプラットフォーム  
サービスURL: https://food.taskra.jp  
リポジトリ: https://github.com/dat0925/foodai

### コンセプト
- 顧客 → LINEで予約（新しいアプリ不要）
- オーナー → LINEで質問・指示 or ダッシュボードで確認
- AIエージェントがUIそのもの

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| ホスティング | GitHub Pages（food.taskra.jp） |
| フロントエンド | HTML/CSS/JS（SPA、フレームワークなし） |
| バックエンド | Supabase Edge Functions（Deno） |
| DB | Supabase PostgreSQL（プロジェクト: sfhtvtcmgueystyuhzvd） |
| AI | Claude API（claude-sonnet-4-20250514） |
| LINE連携 | LINE Messaging API |
| 認証 | PIN認証（SHA-256ハッシュ、auth.js） |

**重要**: SupabaseはTaskraと同じプロジェクト（sfhtvtcmgueystyuhzvd）を共用。テーブル名は全て `foodai_` プレフィックスで分離。環境変数も `FOODAI_` プレフィックスで分離。

---

## リポジトリ構成

```
foodai/
├── index.html              # LP（food.taskra.jp/）
├── auth.js                 # PIN認証共通モジュール（PIN: 2759）
├── line-qr.png             # LINE友だち追加QR
├── logo.jpg                # FoodAIロゴ
├── app/
│   └── index.html          # 管理ダッシュボード（food.taskra.jp/app/）
├── supabase/
│   ├── migrations/
│   │   └── 001_initial.sql # DBテーブル定義
│   ├── functions/
│   │   ├── foodai-line-webhook/
│   │   │   └── index.ts    # LINEからのWebhook受信・AI応答・空席チェック
│   │   └── foodai-send-reply/
│   │       └── index.ts    # オーナーからLINEへの返信送信
│   └── SETUP.md            # デプロイ手順書
├── docs/
│   └── DESIGN.md           # システム設計書
└── CLAUDE.md               # このファイル
```

---

## Supabase 情報

**プロジェクトref**: `sfhtvtcmgueystyuhzvd`  
**URL**: `https://sfhtvtcmgueystyuhzvd.supabase.co`

### DBテーブル

| テーブル名 | 内容 |
|-----------|------|
| `foodai_shops` | 店舗情報・LINE設定・FAQ・空席設定 |
| `foodai_reservations` | 予約データ |
| `foodai_staff` | スタッフ・時給 |
| `foodai_shifts` | シフト |
| `foodai_demand_forecasts` | 繁忙予測 |
| `foodai_conversations` | LINE会話履歴（AIの文脈保持） |

### foodai_shops の主要カラム
```sql
capacity_per_slot  int  default 20   -- 1枠あたりの最大受入人数
slot_minutes       int  default 30   -- 枠の長さ（分）
opening_hours      jsonb             -- 営業時間
faq                jsonb             -- よくある質問
line_channel_id    text
line_channel_secret text
line_access_token  text
```

### デモ店舗
```
shop_id: a1b2c3d4-0000-0000-0000-000000000001
店舗名: 麺屋 暁
capacity_per_slot: 20
slot_minutes: 30
```

### RLSポリシー
- `service_role` → 全テーブルフルアクセス（Edge Functions用）
- `anon` → 全テーブルSELECTのみ（ダッシュボード用）

---

## Edge Functions

### foodai-line-webhook
- URL: `https://sfhtvtcmgueystyuhzvd.supabase.co/functions/v1/foodai-line-webhook`
- JWT認証: **OFF**（LINE署名検証をコード内で実施）
- 処理フロー:
  1. LINE署名検証
  2. 会話履歴をDBから取得
  3. Claude APIで返答生成
  4. `<CHECK_AVAILABILITY>` タグで空席チェック実行
     - 空きあり → 予約確定
     - 満席 → 前後3枠から代替時間を検索して提案
  5. `<RESERVATION>` タグで予約をDBに保存
  6. LINEに返信

### foodai-send-reply
- URL: `https://sfhtvtcmgueystyuhzvd.supabase.co/functions/v1/foodai-send-reply`
- JWT認証: **OFF**
- 処理: オーナーのダッシュボードからLINEへpushメッセージ送信 + 会話履歴に保存

---

## 環境変数（Supabase Edge Function Secrets）

| 変数名 | 内容 |
|-------|------|
| `FOODAI_LINE_CHANNEL_SECRET` | LINE Channel Secret |
| `FOODAI_LINE_ACCESS_TOKEN` | LINE Channel Access Token |
| `FOODAI_ANTHROPIC_API_KEY` | Claude API キー |
| `FOODAI_SHOP_ID` | `a1b2c3d4-0000-0000-0000-000000000001` |
| `SUPABASE_URL` | 自動注入 |
| `SUPABASE_SERVICE_ROLE_KEY` | 自動注入 |

---

## LINE設定

| 項目 | 値 |
|-----|---|
| Channel ID | 2010226409 |
| 友だち追加URL | https://lin.ee/7yYFMI7 |
| 応答モード | Bot |
| Webhook | ON |
| 自動応答メッセージ | OFF |

---

## ダッシュボード実装状況

### 完成（実データ接続済み）
- ✅ ダッシュボードパネル（今月予約数・確定数・来客数・本日予約）
- ✅ 本日の予約一覧テーブル
- ✅ LINE予約パネル（会話履歴・ユーザー一覧・オーナー返信）
- ✅ LINEQRカード（友だち追加・印刷対応）

### デモデータのまま（未接続）
- ⬜ シフト×繁忙予測パネル
- ⬜ MEOパネル（Premiumプラン用、未実装）
- ⬜ AIアシスタントパネル（Claude API接続済みだが店舗データはハードコード）

---

## 現在の完成度（10段階）

```
3.5 / 10

完成: LP・DB・LINE予約エージェント（空席管理含む）・ダッシュボード基本
未着手: Stripe課金・シフト機能・MEO・リマインダー・多店舗対応
```

---

## 次に作るべきもの（優先順）

### Phase 1 残り
1. **予約リマインダー** — 前日・当日にLINEで自動送信（Supabase Cron）
2. **AIアシスタントを実データに接続** — shop_idベースで予約データを取得してClaude APIに渡す
3. **シフトパネルを実データに接続** — foodai_shifts・foodai_staff テーブルを使う
4. **ダッシュボードの空席設定UI** — capacity_per_slot・slot_minutes をオーナーが画面から変更できるように

### Phase 2
5. **Stripe課金** — Free/Standard/Premiumプランの月額課金
6. **あいさつメッセージ改善** — 友だち追加時のLINEメッセージをFoodAIらしく
7. **多店舗対応** — shop_idで完全分離されているので拡張しやすい

---

## 空席管理の仕様

```
方式: シンプルなスロット管理（Aパターン）

チェックロジック:
  同じ日の同じ枠（slot_minutes分）に確定・pending予約の人数合計を取得
  合計 + 今回の人数 > capacity_per_slot → 満席
  満席の場合: 前後3枠（delta×slot_minutes分）から空き枠を最大3件検索して提案

Edge Function内の処理順序:
  1. Claude APIが <CHECK_AVAILABILITY> タグを出力
  2. Functionがチェック実行
  3. 空きあり → 通常の予約フローへ
  4. 満席 → 代替時間を含む返答を即座に返す（Claude APIを再呼び出しせず）
```

---

## 開発上の注意点

- **オーナーはiPad/iPhone使用** → スマホ最適化必須、コンソールアクセス不可
- **コード変更はGitHub経由** → git push後にGitHub Pagesに自動反映（1〜2分）
- **Edge Functionの変更** → Supabaseダッシュボードでコードを直接編集してDeploy
- **日付はJST基準** → `new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })` を使う
- **GitHubへのpush時はPATが必要** → 使い捨てPATを都度発行・使用後即revoke
- **Taskraとの共存** → テーブル名・環境変数・Edge Function名すべて `foodai_` / `FOODAI_` プレフィックス必須
- **Edge Function再デプロイ** → Secretsを変更した場合も再デプロイが必要

---

## フロントエンドの設計方針

- Syne → **ロゴのみ**使用
- 数字・データ表示 → **Inter**
- 見出し → **Shippori Mincho**（serif）
- 本文 → **Noto Sans JP**
- カラーパレット: `--amber: #D4883A`, `--ink: #0E0C0A`, `--cream: #F0E8DA`
- PIN認証: `auth.js` を全ページで読み込み → `requireAuth(() => {})` を呼ぶ
- Supabaseクライアント（ダッシュボード）:
  ```js
  const FOODAI_SUPABASE_URL = 'https://sfhtvtcmgueystyuhzvd.supabase.co'
  const FOODAI_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // app/index.html内
  const FOODAI_SHOP_ID  = 'a1b2c3d4-0000-0000-0000-000000000001'
  const foodaiDb = supabase.createClient(FOODAI_SUPABASE_URL, FOODAI_ANON_KEY)
  ```

---

## よく使うURL

```
LP:              https://food.taskra.jp/
ダッシュボード:   https://food.taskra.jp/app/
Supabase:        https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd
SQL Editor:      https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/sql/new
Edge Functions:  https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/functions
Secrets:         https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/settings/functions
GitHub:          https://github.com/dat0925/foodai
引き継ぎ書(Raw): https://raw.githubusercontent.com/dat0925/foodai/main/CLAUDE.md
LINE Console:    https://developers.line.biz/console/
LINE Manager:    https://manager.line.biz/
```
