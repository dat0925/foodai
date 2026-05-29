# FoodAI 技術者向け設計書

**作成日**: 2026年5月29日  
**対象読者**: 受託開発者・エンジニア  
**プロダクト**: FoodAI — 飲食店専用AIエージェントプラットフォーム

---

## 1. プロダクト概要

### 1.1 サービス概要

飲食店向けのAIエージェントSaaS。顧客はLINEで予約し、オーナーはダッシュボードで管理する。

| エンドポイント | URL |
|-------------|-----|
| LP | https://food.taskra.jp/ |
| 管理ダッシュボード | https://food.taskra.jp/app/ |
| GitHub | https://github.com/dat0925/foodai |

### 1.2 料金プラン

| プラン | 月額 | 主な機能 |
|--------|------|---------|
| Free | ¥0 | LINE予約（月50件） |
| Standard | ¥5,500 | LINE予約（無制限）＋シフト予測 |
| Premium | ¥9,800 | 全機能＋MEOエージェント |

---

## 2. 現在の実装状況

### 2.1 完成済み機能

| 機能 | 場所 | 状態 |
|------|------|------|
| LINE予約AIエージェント | Edge Function | ✅ 稼働中 |
| リアルタイム空席チェック | Edge Function | ✅ 稼働中 |
| 予約リマインダー（前日/当日） | Edge Function + Cron | ✅ 稼働中 |
| 管理ダッシュボード | app/index.html | ✅ 稼働中 |
| 空席設定 | ダッシュボード | ✅ 稼働中 |
| スタッフ管理 | ダッシュボード | ✅ 稼働中 |
| シフト管理 | ダッシュボード | ✅ 稼働中 |
| 通知設定 | ダッシュボード | ✅ 稼働中 |
| AIアシスタント | ダッシュボード | ✅ 稼働中 |

### 2.2 未実装（今回の依頼対象）

| 機能 | 優先度 | 概要 |
|------|--------|------|
| **ユーザー管理・認証** | 🔴 高 | 店舗ごとのアカウント・ログイン |
| **プラン管理** | 🔴 高 | 契約プランのDB管理・機能制限 |
| **Stripe課金** | 🔴 高 | 月額サブスクリプション |
| **多店舗対応** | 🟡 中 | 1アカウントで複数店舗 |
| **MEOエージェント** | 🟡 中 | Googleマップ口コミ返信・投稿 |
| **シフト希望収集** | 🟢 低 | LINEでスタッフから希望収集 |

---

## 3. 技術スタック

### 3.1 現在の構成

```
フロントエンド
├── LP:          HTML/CSS/JS（GitHub Pages）
└── ダッシュボード: HTML/CSS/JS（GitHub Pages）
    ├── Supabase JS SDK（CDN）
    └── PIN認証（auth.js）

バックエンド
└── Supabase
    ├── PostgreSQL（DB）
    ├── Edge Functions（Deno/TypeScript）
    ├── Row Level Security（RLS）
    └── Cron（pg_cron）

外部サービス
├── Claude API（Anthropic）
├── LINE Messaging API
└── GitHub Pages（ホスティング）
```

### 3.2 重要な制約

- **Supabase共用**: TaskraアプリのSupabaseプロジェクトと同一。テーブル・環境変数・Edge Function名はすべて `foodai_` / `FOODAI_` プレフィックス必須
- **フレームワークなし**: フロントエンドはピュアHTML/JS。Reactなどは現在不使用
- **GitHub Pages**: サーバーサイドレンダリング不可。動的処理はすべてEdge Functionsへ

---

## 4. データベース設計

### 4.1 接続情報

| 項目 | 値 |
|-----|---|
| Supabase Project Ref | `sfhtvtcmgueystyuhzvd` |
| REST API URL | `https://sfhtvtcmgueystyuhzvd.supabase.co` |

### 4.2 既存テーブル一覧

```sql
foodai_shops            -- 店舗情報（メインテーブル）
foodai_reservations     -- 予約データ
foodai_staff            -- スタッフ情報
foodai_shifts           -- シフトデータ
foodai_conversations    -- LINE会話履歴
foodai_slot_overrides   -- 日別・時間別の空席特別設定
foodai_demand_forecasts -- 繁忙予測データ
```

### 4.3 主要テーブルのスキーマ

```sql
-- 店舗テーブル
foodai_shops (
  id                  uuid PRIMARY KEY,
  name                text NOT NULL,
  line_channel_id     text,
  line_channel_secret text,
  line_access_token   text,
  opening_hours       jsonb DEFAULT '{}',
  faq                 jsonb DEFAULT '[]',
  capacity_per_slot   int  DEFAULT 20,
  slot_minutes        int  DEFAULT 30,
  reminder_settings   jsonb DEFAULT '{"day_before":{"enabled":true,"hour":18},"day_of":{"enabled":true,"hour":9}}',
  created_at          timestamptz DEFAULT now()
)

-- 予約テーブル
foodai_reservations (
  id                  uuid PRIMARY KEY,
  shop_id             uuid REFERENCES foodai_shops(id),
  name                text NOT NULL,
  phone               text,
  line_user_id        text,
  date                date NOT NULL,
  time                time NOT NULL,
  party_size          int  NOT NULL,
  status              text DEFAULT 'confirmed',  -- confirmed/pending/cancelled/no_show
  note                text,
  reminded_day_before boolean DEFAULT false,
  reminded_day_of     boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
)
```

### 4.4 現在のRLSポリシー

```
service_role → 全テーブルにフルアクセス（Edge Functions用）
anon         → 全テーブルにSELECTのみ（ダッシュボード用）
```

**⚠️ 注意**: 現在のRLSは認証なしのanon読み取りを許可しています。ユーザー管理実装時には適切なポリシーに変更が必要です。

---

## 5. ユーザー管理・課金の実装要件

### 5.1 必要なテーブル追加

```sql
-- 契約者（オーナー）テーブル
foodai_owners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE NOT NULL,
  name         text,
  created_at   timestamptz DEFAULT now()
)
-- ※ Supabase Auth の auth.users と紐付ける

-- サブスクリプションテーブル
foodai_subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid REFERENCES foodai_owners(id),
  shop_id              uuid REFERENCES foodai_shops(id),
  plan                 text NOT NULL DEFAULT 'free',  -- free/standard/premium
  status               text NOT NULL DEFAULT 'active', -- active/cancelled/past_due
  stripe_customer_id   text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  created_at           timestamptz DEFAULT now()
)

-- foodai_shops に owner_id カラムを追加
ALTER TABLE foodai_shops ADD COLUMN owner_id uuid REFERENCES foodai_owners(id);
```

### 5.2 認証フロー

```
推奨: Supabase Auth（Google OAuth または Email/Password）

現在: PIN認証（auth.js）
  → ローカルのSHA-256ハッシュ照合
  → 単一PIN（2759）で全ページ共通
  → 本番運用には不適切

移行後:
  Supabase Auth でログイン
  → JWT にユーザーIDが入る
  → RLSで shop_id ベースのデータ分離
```

### 5.3 RLSの変更方針

```sql
-- 例: 予約テーブルのRLS（オーナーは自分の店舗のみ読み書き可能）
CREATE POLICY "owners_own_shops" ON foodai_reservations
  FOR ALL USING (
    shop_id IN (
      SELECT id FROM foodai_shops
      WHERE owner_id = auth.uid()
    )
  );
```

### 5.4 プランによる機能制限

```js
// ダッシュボード側で実装する機能ゲート例
const PLAN_FEATURES = {
  free:     ['reservation'],
  standard: ['reservation', 'shift', 'staff', 'reminder'],
  premium:  ['reservation', 'shift', 'staff', 'reminder', 'meo', 'ai_assistant']
}

// Edge Function側でも予約件数上限チェックが必要
// free: 月50件まで
// standard: 月500件まで
// premium: 無制限
```

### 5.5 Stripe連携

```
推奨構成:
  Stripe Products（プラン定義）
    ├── Free: price_xxx（¥0）
    ├── Standard: price_xxx（¥5,500/月）
    └── Premium: price_xxx（¥9,800/月）

  Webhook エンドポイント（新規Edge Function: foodai-stripe-webhook）
    ├── customer.subscription.created → foodai_subscriptions に INSERT
    ├── customer.subscription.updated → plan / status を UPDATE
    └── customer.subscription.deleted → status を 'cancelled' に UPDATE

  決済フロー:
    LP「無料で始める」→ Supabase Auth でサインアップ
    → Free プランで店舗作成
    → ダッシュボード内アップグレードボタン → Stripe Checkout
    → Webhook で DB 更新
```

---

## 6. Edge Functions

### 6.1 既存Functions一覧

| Function名 | JWT認証 | 役割 |
|------------|---------|------|
| `foodai-line-webhook` | OFF | LINEからWebhook受信・AI予約対応 |
| `foodai-send-reply` | OFF | オーナーからLINEへ返信 |
| `foodai-reminder` | OFF | 予約リマインダー送信（Cron） |
| `foodai-ai-proxy` | OFF | ダッシュボードのAIアシスタント用プロキシ |

### 6.2 追加が必要なFunctions

| Function名 | 役割 |
|------------|------|
| `foodai-stripe-webhook` | Stripe Webhookを受信してDB更新 |
| `foodai-onboard` | 新規店舗のセットアップ処理 |

### 6.3 環境変数（Supabase Secrets）

| 変数名 | 値 | 説明 |
|-------|---|------|
| `FOODAI_LINE_CHANNEL_SECRET` | ※秘匿 | LINE署名検証用 |
| `FOODAI_LINE_ACCESS_TOKEN` | ※秘匿 | LINE送信用 |
| `FOODAI_ANTHROPIC_API_KEY` | ※秘匿 | Claude API |
| `FOODAI_SHOP_ID` | `a1b2c3d4-...` | デモ店舗ID（本番では不要） |
| `SUPABASE_URL` | 自動注入 | |
| `SUPABASE_SERVICE_ROLE_KEY` | 自動注入 | |
| `STRIPE_SECRET_KEY` | ※未設定 | Stripe連携時に追加 |
| `STRIPE_WEBHOOK_SECRET` | ※未設定 | Stripe Webhook検証 |

---

## 7. 多店舗対応の設計

現在のコードはすでに `shop_id` ベースで設計されており、拡張しやすい状態です。

```
必要な変更:
1. foodai_shops.owner_id を追加（上記参照）
2. foodai-line-webhook を shop_id 動的取得に変更
   現在: 環境変数 FOODAI_SHOP_ID から取得
   変更後: LINE Channel IDからDBで shop_id を検索

3. LINE Channel は店舗ごとに別チャンネルが必要
   → foodai_shops.line_channel_id で識別
   → Webhook URL は全店舗共通でOK（Channel IDで振り分け）
```

---

## 8. フロントエンド

### 8.1 ファイル構成

```
foodai/
├── index.html      # LP
├── auth.js         # PIN認証（本番ではSupabase Authに移行）
├── logo.jpg        # ロゴ
├── line-qr.png     # LINE QRコード
└── app/
    └── index.html  # ダッシュボード（約2,700行）
```

### 8.2 ダッシュボードの構成

`app/index.html` は単一ファイルSPA。セクションごとにパネルを切り替える。

```
パネル一覧（id="panel-xxx"）:
  panel-dashboard   ダッシュボード（統計・予約一覧）
  panel-reservation LINE予約（会話履歴・返信）
  panel-shift       シフト管理
  panel-meo         MEO（未実装）
  panel-seats       空席設定
  panel-staff       スタッフ管理
  panel-notify      通知設定
  panel-ai          AIアシスタント
```

### 8.3 Supabaseクライアント

```js
// app/index.html 内に定義
const FOODAI_SUPABASE_URL = 'https://sfhtvtcmgueystyuhzvd.supabase.co'
const FOODAI_ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const FOODAI_SHOP_ID      = 'a1b2c3d4-0000-0000-0000-000000000001'
const foodaiDb = supabase.createClient(FOODAI_SUPABASE_URL, FOODAI_ANON_KEY)
```

ユーザー認証実装後は `FOODAI_SHOP_ID` をセッションから動的に取得する形に変更が必要。

### 8.4 デザイントークン

```css
:root {
  --bg:      #111009;
  --surface: #1C1914;
  --card:    #242018;
  --border:  rgba(255,255,255,.10);
  --amber:   #D4883A;
  --cream:   #F5EDE0;
  --mist:    #9E948A;
  --green:   #3DBD7A;
  --red:     #E05555;
  --line:    #06C755;
}
```

フォント:
- ロゴ: `Syne` (weight: 800)
- 数値・データ: `Inter`
- 本文: `Noto Sans JP`

---

## 9. 開発環境のセットアップ

### 9.1 リポジトリのクローン

```bash
git clone https://github.com/dat0925/foodai.git
cd foodai
```

### 9.2 ローカル確認

フロントエンドはHTMLファイルを直接ブラウザで開くだけで動作する。  
ただしSupabaseへの接続が必要なため、実データの確認にはネット接続が必要。

```bash
# Python でローカルサーバーを立てる場合
python3 -m http.server 8080
# → http://localhost:8080/ でLP確認
# → http://localhost:8080/app/ でダッシュボード確認
```

### 9.3 Edge Functionのデプロイ

現在はSupabaseダッシュボードの画面から手動でコードを貼り付けてデプロイしている。  
本格運用では `supabase CLI` を使ったデプロイが推奨。

```bash
# Supabase CLI でのデプロイ例
supabase functions deploy foodai-line-webhook --project-ref sfhtvtcmgueystyuhzvd
```

### 9.4 本番環境への反映

```
フロントエンド: git push → GitHub Pages に自動反映（1〜2分）
Edge Function: Supabaseダッシュボード または supabase CLI でDeploy
DB変更:        Supabase SQL Editor で実行
```

---

## 10. セキュリティ上の注意点

1. **RLSを必ず有効化する**  
   現在はanon読み取りを許可しているが、ユーザー認証実装後はowner_idベースのRLSに変更すること

2. **LINE署名検証**  
   `foodai-line-webhook` では `x-line-signature` を必ず検証している。JWT認証はOFFだが、このLINE署名検証がセキュリティを担保している

3. **Stripe Webhookの署名検証**  
   `STRIPE_WEBHOOK_SECRET` を使った署名検証を必ず実装すること

4. **Supabase共用プロジェクト**  
   TaskraアプリのDBを共用しているため、RLS設定の変更は慎重に行うこと

5. **anon キーの扱い**  
   現在フロントエンドにanon キーが露出しているが、RLSが正しく設定されていれば問題ない。それ以上の保護が必要な場合はEdge Function経由に変更する

---

## 11. よく使うURL

```
LP:              https://food.taskra.jp/
ダッシュボード:   https://food.taskra.jp/app/
Supabase:        https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd
SQL Editor:      https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/sql/new
Edge Functions:  https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/functions
Secrets:         https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/settings/functions
Table Editor:    https://supabase.com/dashboard/project/sfhtvtcmgueystyuhzvd/editor
GitHub:          https://github.com/dat0925/foodai
LINE Console:    https://developers.line.biz/console/
LINE Manager:    https://manager.line.biz/
Stripe:          https://dashboard.stripe.com/
```
