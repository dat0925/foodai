# FoodAI — 飲食店専用AIエージェントプラットフォーム

飲食店の繰り返し業務をAIエージェントが代替する。  
予約対応・シフト組み・口コミ管理を自動化。

## 構成

```
foodai/
├── lp/index.html       # ランディングページ
├── app/index.html      # 管理ダッシュボード（デモ）
└── docs/DESIGN.md      # 設計書
```

## エージェント

| エージェント | 機能 |
|-------------|------|
| LINE予約 | 24時間自動予約受付・変更・キャンセル対応 |
| シフト×繁忙予測 | 来客予測・シフト自動生成・LINE通知 |
| MEO（Premium） | Googleマップ口コミ返信・定期投稿 |

## 料金

| プラン | 月額 |
|--------|------|
| Free | ¥0 |
| Standard | ¥5,500 |
| Premium | ¥9,800 |

## 技術スタック

- Frontend: HTML/CSS/JS
- Backend: Supabase Edge Functions
- AI: Claude API
- 認証: Supabase Auth（Google OAuth）
- LINE連携: LINE Messaging API

## 設計書

詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照。
