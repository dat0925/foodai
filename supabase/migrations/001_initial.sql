-- ============================================================
-- FoodAI 初期マイグレーション
-- Supabase SQL Editor に貼り付けて実行してください
-- ============================================================

-- ── 店舗テーブル
create table if not exists foodai_shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  line_channel_id      text,
  line_channel_secret  text,
  line_access_token    text,
  opening_hours   jsonb default '{}',
  faq             jsonb default '[]',
  created_at      timestamptz default now()
);

-- ── 予約テーブル
create table if not exists foodai_reservations (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references foodai_shops(id) on delete cascade,
  name            text not null,
  phone           text,
  line_user_id    text,
  date            date not null,
  time            time not null,
  party_size      int not null,
  status          text not null default 'confirmed',
  note            text,
  created_at      timestamptz default now(),
  constraint status_check check (status in ('confirmed','pending','cancelled','no_show'))
);

-- ── スタッフテーブル
create table if not exists foodai_staff (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references foodai_shops(id) on delete cascade,
  name            text not null,
  line_user_id    text,
  role            text default 'hall',
  hourly_wage     int default 1100,
  created_at      timestamptz default now()
);

-- ── シフトテーブル
create table if not exists foodai_shifts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references foodai_shops(id) on delete cascade,
  staff_id        uuid not null references foodai_staff(id) on delete cascade,
  date            date not null,
  start_time      time not null,
  end_time        time not null,
  status          text not null default 'draft',
  created_at      timestamptz default now(),
  constraint shift_status_check check (status in ('draft','confirmed'))
);

-- ── 繁忙予測テーブル
create table if not exists foodai_demand_forecasts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references foodai_shops(id) on delete cascade,
  date            date not null,
  hour            int not null check (hour between 0 and 23),
  predicted_guests int,
  actual_guests   int,
  weather         text,
  created_at      timestamptz default now()
);

-- ── LINE会話履歴テーブル（AIの文脈保持用）
create table if not exists foodai_conversations (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references foodai_shops(id) on delete cascade,
  line_user_id    text not null,
  role            text not null,   -- 'user' | 'assistant'
  content         text not null,
  created_at      timestamptz default now()
);

-- ============================================================
-- インデックス
-- ============================================================
create index if not exists idx_reservations_shop_date
  on foodai_reservations(shop_id, date);

create index if not exists idx_conversations_shop_user
  on foodai_conversations(shop_id, line_user_id, created_at desc);

create index if not exists idx_shifts_shop_date
  on foodai_shifts(shop_id, date);

-- ============================================================
-- RLS 有効化
-- ============================================================
alter table foodai_shops               enable row level security;
alter table foodai_reservations        enable row level security;
alter table foodai_staff               enable row level security;
alter table foodai_shifts              enable row level security;
alter table foodai_demand_forecasts    enable row level security;
alter table foodai_conversations       enable row level security;

-- ============================================================
-- RLS ポリシー（service_role は全テーブルにフルアクセス）
-- ============================================================

-- shops
create policy "service_role full access shops"
  on foodai_shops for all
  using (auth.role() = 'service_role');

-- reservations
create policy "service_role full access reservations"
  on foodai_reservations for all
  using (auth.role() = 'service_role');

-- staff
create policy "service_role full access staff"
  on foodai_staff for all
  using (auth.role() = 'service_role');

-- shifts
create policy "service_role full access shifts"
  on foodai_shifts for all
  using (auth.role() = 'service_role');

-- demand_forecasts
create policy "service_role full access forecasts"
  on foodai_demand_forecasts for all
  using (auth.role() = 'service_role');

-- conversations
create policy "service_role full access conversations"
  on foodai_conversations for all
  using (auth.role() = 'service_role');

-- ============================================================
-- デモ用初期データ（麺屋 暁）
-- ============================================================
insert into foodai_shops (id, name, opening_hours, faq) values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  '麺屋 暁',
  '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"11:00","close":"21:00"}}',
  '[{"q":"アレルギー対応はありますか？","a":"はい、事前にお知らせいただければ対応可能なものもございます。"},{"q":"駐車場はありますか？","a":"近隣にコインパーキングがございます。"},{"q":"子供連れでも大丈夫ですか？","a":"もちろんです。お子様連れも大歓迎です。"}]'
) on conflict (id) do nothing;
