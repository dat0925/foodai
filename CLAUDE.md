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
│   │   ├── 001_initial.sql            # DBテーブル定義
│   │   ├── 002_slot_overrides.sql     # 日付×時間特別設定テーブル
│   │   ├── 003_reminder_flags.sql     # 予約リマインダー送信済みフラグ
│   │   └── 004_reminder_settings.sql  # 店舗ごとのリマインダー設定カラム
│   ├── functions/
│   │   ├── foodai-line-webhook/
│   │   │   └── index.ts    # LINEからのWebhook受信・AI応答・空席チェック
│   │   ├── foodai-send-reply/
│   │   │   └── index.ts    # オーナーからLINEへの返信送信
│   │   └── foodai-reminder/
│   │       └── index.ts    # 予約リマインダー（前日18時・当日9時、DB設定で変更可）
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
| `foodai_shops` | 店舗情報・LINE設定・FAQ・空席設定・リマインダー設定 |
| `foodai_reservations` | 予約データ（reminded_day_before / reminded_day_of フラグあり） |
| `foodai_staff` | スタッフ・時給 |
| `foodai_shifts` | シフト（draft / confirmed） |
| `foodai_demand_forecasts` | 繁忙予測 |
| `foodai_conversations` | LINE会話履歴（AIの文脈保持） |
| `foodai_slot_overrides` | 日付×時間ごとの特別設定（臨時休業・定員変更） |

### foodai_shops の主要カラム
```sql
capacity_per_slot   int    default 20
slot_minutes        int    default 30
opening_hours       jsonb  -- 曜日別営業時間
faq                 jsonb  -- よくある質問
line_channel_id     text
line_channel_secret text
line_access_token   text
reminder_settings   jsonb  -- {"day_before":{"enabled":true,"hour":18},"day_of":{"enabled":true,"hour":9}}
```

### foodai_reservations の主要カラム
```sql
name                text
date                date
time                time
party_size          int
status              text   -- confirmed / pending / cancelled / no_show
line_user_id        text
reminded_day_before boolean default false
reminded_day_of     boolean default false
```

### foodai_staff の主要カラム
```sql
name         text
role         text   -- 'hall' | 'kitchen' | 'manager'
hourly_wage  int
line_user_id text
```

### foodai_shifts の主要カラム
```sql
staff_id    uuid
date        date
start_time  time
end_time    time
status      text   -- 'draft' | 'confirmed'
```

### デモ店舗
```
shop_id: a1b2c3d4-0000-0000-0000-000000000001
店舗名: 麺屋 暁
```

### RLSポリシー
- `service_role` → 全テーブルフルアクセス（Edge Functions用）
- `anon` → 全テーブルSELECTのみ（ダッシュボード用）

---

## Edge Functions

### foodai-line-webhook
- JWT認証: **OFF**
- 処理フロー:
  1. LINE署名検証
  2. 会話履歴をDBから取得
  3. Claude APIで返答生成（1回目）
  4. `<CHECK_AVAILABILITY>` タグで空席チェック
     - 空きあり → Claude APIを**再呼び出し**して予約確定メッセージ生成
     - 満席 → 前後6枠から代替時間を時系列順・最大3件提案（当日は現在時刻以前除外）
  5. `<RESERVATION>` タグで予約をDBに保存
  6. LINEに返信・会話履歴保存

### foodai-send-reply
- JWT認証: **OFF**
- 処理: オーナーダッシュボードからLINEへpushメッセージ送信 + 会話履歴保存

### foodai-reminder
- JWT認証: **OFF**
- Supabase Cronで毎日2回実行（UTC 9:00 / 0:00 = JST 18:00 / 9:00）
- DBの `reminder_settings` を参照して時間・ON/OFFを動的に制御
- 送信済みフラグ（`reminded_day_before` / `reminded_day_of`）で重複送信防止

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
- ✅ ダッシュボードパネル（予約サマリー・本日の予約一覧）
- ✅ オンボーディングカード（5ステップ・進捗バー・パネル遷移・dismiss対応）
- ✅ LINE予約パネル（会話履歴・ユーザー一覧・オーナー返信）
- ✅ LINEQRカード（友だち追加・印刷対応）
- ✅ 空席設定パネル（基本設定・日別残席ビュー・特別設定CRUD）
- ✅ スタッフ管理パネル（一覧・追加・編集・削除・月間人件費プレビュー）
- ✅ シフト管理パネル（週グリッド・セルタップ入力・ドラフト→確定フロー）
- ✅ 通知設定パネル（前日/当日ON/OFF・時間変更・Cron SQL自動生成）

### 未完成
- ⬜ AIアシスタントパネル（Claude API接続済みだが店舗データはハードコード）
- ⬜ MEOパネル（Premiumプラン用、未実装）

### UI仕様
- トップバーに「📱 スマホで開く」→ QRポップオーバー
- サイドバー折りたたみ対応（折りたたんだ状態でもトグルボタン表示）
- モバイル対応（ハンバーガーメニュー）
- セレクトボックス: `option { background: #2A2218; color: var(--cream); }`

---

## 現在の完成度（10段階）

```
7.0 / 10

完成: LP・DB・LINE予約エージェント・ダッシュボード全パネル・
      空席設定・スタッフ管理・シフト管理・通知設定・オンボーディング
未着手: AIアシスタント実データ接続・シフト希望収集・Stripe課金・MEO・多店舗対応
```

---

## 次に作るべきもの（優先順）

### Phase 1 残り
1. **AIアシスタントを実データに接続** — 予約・シフト・スタッフの実データをClaudeに渡す

### Phase 2
2. **シフト希望収集** — LINEでスタッフから希望を収集
3. **Stripe課金** — Free/Standard/Premiumプランの月額課金
4. **あいさつメッセージ改善** — 友だち追加時のLINEメッセージをFoodAIらしく
5. **多店舗対応** — shop_idで完全分離されているので拡張しやすい

---

## 空席管理の仕様

```
方式: シンプルなスロット管理

チェックロジック:
  同じ日の同じ枠（slot_minutes分）に確定・pending予約の人数合計を取得
  合計 + 今回の人数 > capacity_per_slot → 満席
  満席の場合: 前後6枠（候補を時系列順ソート）から空き枠を最大3件検索して提案
  当日の場合: 現在時刻（JST）以前の枠は代替候補から除外

特別設定（foodai_slot_overrides）が優先:
  type='closed' → その枠は予約不可
  type='custom' → capacity を上書き

Edge Function処理順序:
  1. Claude APIが <CHECK_AVAILABILITY> タグを出力
  2. Functionがチェック実行
  3. 空きあり → Claude APIを再呼び出し → 予約確定メッセージ生成
  4. 満席 → 代替時間を即座に返す（Claude APIを再呼び出しせず）
```

---

## オンボーディングの仕様

5ステップをDBから動的にチェック：
1. LINE連携 → `line_access_token` が設定されているか
2. 営業時間設定 → `opening_hours` が入力されているか
3. スタッフ登録 → `foodai_staff` に1件以上あるか
4. リマインダーON → `reminder_settings` でどちらかがONか
5. テスト予約 → `foodai_reservations` に1件以上あるか

- 未完了の次のステップをアンバー色でハイライト
- クリックで該当パネルへ遷移
- 全完了で自動非表示
- 「後で」クリックでlocalStorageに記録して非表示

---

## 開発上の注意点

- **オーナーはiPad/iPhone使用** → スマホ最適化必須
- **コード変更はGitHub経由** → git push後にGitHub Pagesに自動反映（1〜2分）
- **Edge Functionの変更** → Supabaseダッシュボードで直接編集してDeploy
- **日付はJST基準** → `new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })`
- **Taskraとの共存** → テーブル名・環境変数・Edge Function名すべて `foodai_` / `FOODAI_` プレフィックス必須
- **Edge Function再デプロイ** → Secretsを変更した場合も再デプロイが必要

---

## フロントエンドの設計方針

- Syne → ロゴ・見出し（font-weight: 800）
- Inter → 数字・データ表示
- Noto Sans JP → 本文
- カラーパレット:
  ```
  --bg:      #0E0C0A
  --surface: #181512
  --card:    #1E1A16
  --border:  rgba(255,255,255,.07)
  --amber:   #D4883A
  --ember:   #B85C1E
  --cream:   #F0E8DA
  --mist:    #7A6F64
  --green:   #3DBD7A
  --red:     #E05555
  --line:    #06C755
  ```
- PIN認証: `auth.js` を全ページで読み込み → `requireAuth(() => {})` を呼ぶ
- Supabaseクライアント（ダッシュボード）:
  ```js
  const FOODAI_SUPABASE_URL = 'https://sfhtvtcmgueystyuhzvd.supabase.co'
  const FOODAI_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
