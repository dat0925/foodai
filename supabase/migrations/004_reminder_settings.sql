-- reminder_settings カラムを foodai_shops に追加
alter table foodai_shops
  add column if not exists reminder_settings jsonb default '{
    "day_before": {"enabled": true, "hour": 18},
    "day_of":     {"enabled": true, "hour": 9}
  }'::jsonb;
