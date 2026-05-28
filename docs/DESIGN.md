# FoodAI 設計書

## 1. プロダクト概要

### 1.1 プロダクト名
**FoodAI** — 飲食店専用AIエージェントプラットフォーム

### 1.2 コンセプト
飲食店オーナー・店長が抱える「繰り返し業務」をAIエージェントが代替する。  
UIはエージェントそのものであり、従来SaaSのような複雑な画面操作は不要。

### 1.3 ターゲットユーザー
- 中小・個人飲食店オーナー（従業員5〜20名規模）
- 業務効率化に関心があるが、ITリテラシーは高くない
- 月3〜5万円を食べログ等に支払っている層

### 1.4 課題と解決策

| 課題 | 解決するエージェント |
|------|-------------------|
| LINE予約の返信漏れ・手動対応 | LINE予約エージェント |
| シフト作成に週2時間かかる | シフト繁忙予測エージェント |
| 口コミ返信・MEO投稿が滞る | MEOエージェント（別リポジトリ） |

---

## 2. エージェント仕様

### 2.1 LINE予約エージェント

#### 概要
LINE公式アカウントに届く予約・問い合わせメッセージをAIが自動処理する。

#### 機能
- 予約受付（日時・人数・氏名・連絡先の収集）
- 予約変更・キャンセル対応
- 満席時の代替日時提案
- よくある質問への自動回答（営業時間・アレルギー対応など）
- 予約台帳への自動記録
- リマインダー送信（前日・当日）

#### フロー
```
顧客がLINEでメッセージ送信
    ↓
Claude APIで意図分類（予約/変更/キャンセル/質問/その他）
    ↓
[予約の場合]
  必要情報が揃っているか確認
  → 不足情報を会話で収集
  → 空き確認（予約台帳DB参照）
  → 予約確定 → Supabaseに保存
  → 確認メッセージをLINEで返信
    ↓
[質問の場合]
  店舗情報DBを参照してRAG回答
```

#### API連携
- LINE Messaging API（Webhook受信）
- Claude API（意図分類・会話生成）
- Supabase（予約データ保存）

#### データモデル
```sql
-- 予約テーブル
reservations (
  id          uuid PRIMARY KEY,
  shop_id     uuid NOT NULL,
  name        text NOT NULL,          -- 予約者名
  phone       text,
  line_user_id text,
  date        date NOT NULL,
  time        time NOT NULL,
  party_size  int NOT NULL,
  status      text DEFAULT 'confirmed', -- confirmed / cancelled / no_show
  note        text,
  created_at  timestamptz DEFAULT now()
)

-- 店舗設定テーブル
shops (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  line_channel_id text,
  line_channel_secret text,
  opening_hours jsonb,
  faq         jsonb,                  -- よくある質問と回答
  created_at  timestamptz DEFAULT now()
)
```

---

### 2.2 シフト×繁忙予測エージェント

#### 概要
予約データ・曜日・天気・地域イベント情報を組み合わせて来客数を予測し、
最適なシフトを自動提案。LINEでスタッフと調整まで完結。

#### 機能
- 来客数予測（過去予約データ＋外部要因）
- シフト必要人数の自動算出
- スタッフへのシフト希望収集（LINE）
- シフト案の自動生成
- シフト確定通知（LINE一斉送信）
- 人件費試算レポート

#### 予測ロジック
```
予測スコア = 
  基準来客数（過去同曜日・同時間帯の平均）
  × 天気係数（晴れ: 1.1 / 雨: 0.85）
  × イベント係数（近隣イベントあり: 1.3）
  × 季節係数
  + 予約済み確定人数
```

#### フロー
```
毎週月曜AM9時に自動起動
    ↓
翌週の予約データ集計
    ↓
天気API・イベントAPIで外部要因取得
    ↓
Claude APIで来客予測・シフト必要人数算出
    ↓
スタッフのLINEに希望収集メッセージ送信
    ↓
希望収集期限（水曜AM）に自動集計
    ↓
Claude APIでシフト最適化
    ↓
オーナーに確認依頼 → 承認 → スタッフに通知
```

#### データモデル
```sql
-- スタッフテーブル
staff (
  id          uuid PRIMARY KEY,
  shop_id     uuid NOT NULL,
  name        text NOT NULL,
  line_user_id text,
  role        text,                   -- hall / kitchen / manager
  hourly_wage int,
  created_at  timestamptz DEFAULT now()
)

-- シフトテーブル
shifts (
  id          uuid PRIMARY KEY,
  shop_id     uuid NOT NULL,
  staff_id    uuid NOT NULL,
  date        date NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  status      text DEFAULT 'draft',   -- draft / confirmed
  created_at  timestamptz DEFAULT now()
)

-- 繁忙予測テーブル
demand_forecasts (
  id          uuid PRIMARY KEY,
  shop_id     uuid NOT NULL,
  date        date NOT NULL,
  hour        int NOT NULL,
  predicted_guests int,
  actual_guests    int,
  weather     text,
  created_at  timestamptz DEFAULT now()
)
```

---

## 3. システムアーキテクチャ

### 3.1 全体構成

```
┌─────────────────────────────────────────────────────┐
│                    フロントエンド                        │
│  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  LP (静的HTML) │  │  管理ダッシュボード (SPA)        │  │
│  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ↕ HTTPS
┌─────────────────────────────────────────────────────┐
│                  バックエンド (Supabase)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Edge Functions │  │  PostgreSQL  │  │   Auth    │  │
│  │  (AIエージェント)│  │     (DB)     │  │  (OAuth) │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│                   外部サービス                          │
│  Claude API  │  LINE Messaging API  │  天気API        │
└─────────────────────────────────────────────────────┘
```

### 3.2 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フロントエンド | HTML/CSS/JS（SPA） | 軽量・高速・デプロイ容易 |
| バックエンド | Supabase Edge Functions | サーバーレス・低コスト |
| DB | Supabase PostgreSQL | RLS・リアルタイム対応 |
| AI | Claude API (claude-sonnet) | 日本語精度・ツール使用 |
| 認証 | Supabase Auth（Googleログイン） | 飲食店オーナー向け簡易性 |
| ホスティング | GitHub Pages（LP）/ Vercel（App） | |
| LINE連携 | LINE Messaging API | Webhook受信 |

### 3.3 Supabase Edge Functions 構成

```
functions/
├── line-webhook/      # LINEからのWebhook受信・処理
├── reservation-agent/ # 予約AIエージェントのコア処理
├── shift-planner/     # シフト生成・最適化
├── demand-forecast/   # 繁忙予測の実行
└── shift-notify/      # LINE一斉通知送信
```

---

## 4. 料金プラン

| プラン | 月額 | 対象エージェント | 予約件数上限 |
|--------|------|----------------|------------|
| **Free** | 無料 | LINE予約のみ | 50件/月 |
| **Standard** | ¥5,500 | LINE予約＋シフト予測 | 500件/月 |
| **Premium** | ¥9,800 | 全エージェント（MEO含む） | 無制限 |

### 解約率を下げる設計
- データが蓄積されるほど予測精度が上がる（ロックイン）
- スタッフがLINEを使い始めると解約しづらくなる
- 月次レポートで「削減できた人件費・機会損失」を可視化

---

## 5. 開発ロードマップ

### Phase 1（MVP）〜1ヶ月
- [ ] LINE Webhook受信
- [ ] 基本的な予約受付会話フロー
- [ ] 予約台帳（Supabase）
- [ ] 管理ダッシュボード（予約一覧）

### Phase 2 〜2ヶ月
- [ ] シフト希望収集（LINE）
- [ ] 来客数予測
- [ ] シフト自動生成
- [ ] Stripe課金連携

### Phase 3 〜3ヶ月
- [ ] MEOエージェント統合
- [ ] 人件費レポート
- [ ] 多店舗対応
- [ ] モバイルアプリ（PWA）

---

## 6. セキュリティ

- LINE Webhook: `X-Line-Signature` 検証必須
- Supabase RLS: `shop_id` によるデータ分離
- 個人情報（氏名・電話番号）: 暗号化保存
- 管理画面: Google OAuth 必須

---

## 7. ディレクトリ構成

```
foodai/
├── README.md
├── docs/
│   └── DESIGN.md          # この設計書
├── lp/
│   └── index.html         # ランディングページ
├── app/
│   └── index.html         # 管理ダッシュボード（デモ）
└── supabase/
    ├── migrations/
    │   └── 001_initial.sql
    └── functions/
        ├── line-webhook/
        ├── reservation-agent/
        └── shift-planner/
```

---

## 8. UIアーキテクチャ（更新）

### 8.1 UIの役割分担

```
【顧客（エンドユーザー）】
  LINE のみ
  ← 新アプリ不要。既存LINEで予約完結。

【店舗オーナー・スタッフ】
  LINE（AIエージェントへの指示・質問）
    例: 「今日の来店予測は？」「来週土曜のシフトどうなってる？」
    → AIが即答。操作画面不要。

  管理ダッシュボード（確認・設定専用）
    LINEで見づらいもの限定：
    ・予約カレンダー（週次一覧）
    ・シフトグリッド
    ・売上・来客グラフ
    ・スタッフ・店舗設定
```

### 8.2 店舗向けLINEエージェント（追加機能）

顧客向けLINEとは別のLINEチャンネルで実装。

#### 対応コマンド例
| 発話 | AIの応答 |
|------|---------|
| 「今日の来店予測は？」 | 時間帯別予測人数＋天気・イベント要因を返答 |
| 「今週のシフト教えて」 | テキスト形式でシフト一覧を返答 |
| 「土曜が心配、何人必要？」 | 来客予測に基づく推奨人員数を返答 |
| 「昨日の売上は？」 | 予約ベースの来客数・推定売上を返答 |
| 「田中さんに明日シフト確認して」 | 指定スタッフにLINEで自動連絡 |

### 8.3 管理ダッシュボードの設計方針

- **スマートフォン最適化必須**（オーナーはPCを使わない前提）
- ボトムナビゲーション採用
- タップターゲット最小44px
- 操作はダッシュボードではなくLINEで行う設計
  → ダッシュボードはRead-onlyに近い構成

### 8.4 画面構成（SP最適化後）

```
ボトムナビ: ホーム | 予約 | シフト | 設定

ホーム
  ├── 本日のサマリーカード（来客予測・予約数）
  ├── 直近の予約リスト
  └── AIエージェントへのクイックアクセス

予約
  ├── カレンダー週表示
  └── 予約詳細タップで確認

シフト
  ├── 週次シフトグリッド
  └── 来客予測グラフ

設定
  ├── 店舗情報
  ├── スタッフ管理
  └── プラン・請求
```
