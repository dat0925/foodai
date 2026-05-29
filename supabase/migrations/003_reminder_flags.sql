-- 予約リマインダー送信済みフラグを追加
alter table foodai_reservations
  add column if not exists reminded_day_before boolean default false,
  add column if not exists reminded_day_of     boolean default false;
