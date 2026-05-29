-- foodai_slot_overrides: 日付×時間ごとの特別設定テーブル
create table if not exists foodai_slot_overrides (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references foodai_shops(id) on delete cascade,
  date       date not null,                        -- 対象日
  start_time time,                                 -- null = 終日
  end_time   time,                                 -- null = 終日
  type       text not null check (type in ('closed', 'custom')),
  capacity   int,                                  -- typeがcustomの時のみ使用
  note       text,
  created_at timestamptz default now()
);

-- RLS
alter table foodai_slot_overrides enable row level security;

create policy "service_role full access" on foodai_slot_overrides
  for all using (auth.role() = 'service_role');

create policy "anon read" on foodai_slot_overrides
  for select using (true);

-- インデックス（日付で検索が多いので）
create index if not exists foodai_slot_overrides_shop_date
  on foodai_slot_overrides (shop_id, date);
