-- ============================================================
-- FoodAI デモ用サンプルデータ
-- 実行前に既存データをリセットします
-- ============================================================

-- ── クリーンアップ（デモ店舗のデータのみ削除）
delete from foodai_shifts        where shop_id = 'a1b2c3d4-0000-0000-0000-000000000001';
delete from foodai_conversations where shop_id = 'a1b2c3d4-0000-0000-0000-000000000001';
delete from foodai_reservations  where shop_id = 'a1b2c3d4-0000-0000-0000-000000000001';
delete from foodai_slot_overrides where shop_id = 'a1b2c3d4-0000-0000-0000-000000000001';
delete from foodai_staff         where shop_id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- ── 店舗設定を更新
update foodai_shops set
  capacity_per_slot = 20,
  slot_minutes      = 30,
  opening_hours = '{
    "mon": {"open": "11:00", "close": "22:00", "closed": false},
    "tue": {"open": "11:00", "close": "22:00", "closed": false},
    "wed": {"open": "11:00", "close": "22:00", "closed": false},
    "thu": {"open": "11:00", "close": "22:00", "closed": false},
    "fri": {"open": "11:00", "close": "23:00", "closed": false},
    "sat": {"open": "11:00", "close": "23:00", "closed": false},
    "sun": {"open": "11:00", "close": "21:00", "closed": false}
  }',
  faq = '[
    {"q": "アレルギー対応はありますか？", "a": "はい、小麦・卵・乳製品のアレルギーに対応しております。事前にお知らせください。"},
    {"q": "駐車場はありますか？", "a": "店舗前に3台分の駐車スペースがございます。満車の場合は近隣コインパーキングをご利用ください。"},
    {"q": "子供連れでも大丈夫ですか？", "a": "もちろんです。お子様用の食器もご用意しております。"},
    {"q": "予約のキャンセルはできますか？", "a": "前日18時までにこちらのLINEよりご連絡いただければキャンセル可能です。"},
    {"q": "テイクアウトはできますか？", "a": "はい、ラーメン・餃子のテイクアウトに対応しています。LINEでご注文いただけます。"}
  ]',
  reminder_settings = '{
    "day_before": {"enabled": true, "hour": 18},
    "day_of":     {"enabled": true, "hour": 9}
  }'
where id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- ============================================================
-- スタッフ
-- ============================================================
insert into foodai_staff (id, shop_id, name, role, hourly_wage, line_user_id) values
  ('b1000001-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', '田中 拓海', 'manager', 1500, null),
  ('b1000001-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', '佐藤 美咲', 'hall',    1100, null),
  ('b1000001-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', '山田 健太', 'kitchen', 1200, null),
  ('b1000001-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', '中村 彩香', 'hall',    1100, null),
  ('b1000001-0000-0000-0000-000000000005', 'a1b2c3d4-0000-0000-0000-000000000001', '渡辺 隆', 'kitchen',  1150, null);

-- ============================================================
-- 予約（今日を current_date として前後に配置）
-- ============================================================

-- 今月の確定予約（過去分）
insert into foodai_reservations (shop_id, name, line_user_id, date, time, party_size, status, note, reminded_day_before, reminded_day_of) values
  ('a1b2c3d4-0000-0000-0000-000000000001', '鈴木 一郎', 'U001', current_date - 20, '12:00', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '高橋 花子', 'U002', current_date - 20, '13:00', 2,  'confirmed', 'カウンター希望', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '伊藤 誠',   'U003', current_date - 19, '12:30', 6,  'confirmed', '誕生日会', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '渡辺 京子', 'U004', current_date - 19, '18:00', 2,  'cancelled', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '小林 大介', 'U005', current_date - 18, '11:30', 3,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '加藤 由美', 'U006', current_date - 18, '19:00', 8,  'confirmed', '接待', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '松本 翔',   'U007', current_date - 17, '12:00', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '井上 恵子', 'U008', current_date - 17, '13:30', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '木村 浩',   'U009', current_date - 16, '18:30', 2,  'cancelled', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '林 奈々',   'U010', current_date - 16, '19:00', 10, 'confirmed', '会社宴会', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '清水 健司', 'U011', current_date - 14, '12:00', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '山本 理恵', 'U012', current_date - 14, '13:00', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '中島 博',   'U013', current_date - 13, '11:30', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '原田 さくら','U014', current_date - 13, '19:30', 6,  'confirmed', 'アレルギーあり（卵）', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '藤田 直人', 'U015', current_date - 12, '12:30', 3,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '岡田 美穂', 'U016', current_date - 12, '13:00', 2,  'cancelled', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '後藤 賢二', 'U017', current_date - 11, '18:00', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '石田 麻衣', 'U018', current_date - 11, '19:00', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '森 大樹',   'U019', current_date -  7, '12:00', 5,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '池田 千尋', 'U020', current_date -  7, '13:30', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '橋本 洋介', 'U021', current_date -  6, '18:30', 4,  'confirmed', '記念日', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '山口 有紀', 'U022', current_date -  6, '19:00', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '長谷川 進', 'U023', current_date -  5, '12:00', 8,  'confirmed', '同窓会', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '菊地 玲奈', 'U024', current_date -  5, '13:00', 2,  'cancelled', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '村上 光',   'U025', current_date -  4, '11:30', 3,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '近藤 志保', 'U026', current_date -  3, '19:00', 6,  'confirmed', '接待', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '西村 拓哉', 'U027', current_date -  2, '12:30', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '福田 智子', 'U028', current_date -  2, '13:00', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '浜田 宗一', 'U029', current_date -  1, '12:00', 2,  'confirmed', null, true, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '野口 恭子', 'U030', current_date -  1, '19:30', 4,  'confirmed', null, true, false);

-- 本日の予約
insert into foodai_reservations (shop_id, name, line_user_id, date, time, party_size, status, note, reminded_day_before, reminded_day_of) values
  ('a1b2c3d4-0000-0000-0000-000000000001', '坂本 剛',   'U031', current_date, '11:30', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '上田 美紀', 'U032', current_date, '12:00', 4,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '三浦 聡',   'U033', current_date, '12:30', 2,  'confirmed', 'カウンター希望', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '横山 智恵', 'U034', current_date, '13:00', 6,  'confirmed', '子供連れ', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '古川 大輔', 'U035', current_date, '18:00', 2,  'confirmed', null, true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '島田 裕子', 'U036', current_date, '18:30', 4,  'confirmed', '誕生日', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '河野 正樹', 'U037', current_date, '19:00', 8,  'confirmed', '会社の飲み会', true, true),
  ('a1b2c3d4-0000-0000-0000-000000000001', '太田 沙織', 'U038', current_date, '19:30', 2,  'pending',   null, false, false);

-- 明日以降の予約
insert into foodai_reservations (shop_id, name, line_user_id, date, time, party_size, status, note, reminded_day_before, reminded_day_of) values
  ('a1b2c3d4-0000-0000-0000-000000000001', '石川 雄介', 'U039', current_date + 1, '12:00', 4,  'confirmed', null, false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '中田 洋子', 'U040', current_date + 1, '13:00', 2,  'confirmed', null, false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '前田 俊一', 'U041', current_date + 1, '19:00', 6,  'confirmed', '接待', false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '吉田 紀子', 'U042', current_date + 2, '12:30', 3,  'confirmed', null, false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '小川 哲也', 'U043', current_date + 2, '18:30', 10, 'confirmed', '歓迎会', false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '斎藤 愛',   'U044', current_date + 3, '12:00', 2,  'confirmed', null, false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '松田 和彦', 'U045', current_date + 3, '19:00', 4,  'confirmed', '記念日', false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '杉山 真理', 'U046', current_date + 5, '12:00', 2,  'confirmed', null, false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '川口 信夫', 'U047', current_date + 5, '13:30', 8,  'confirmed', '同窓会', false, false),
  ('a1b2c3d4-0000-0000-0000-000000000001', '内田 優花', 'U048', current_date + 7, '18:00', 2,  'confirmed', null, false, false);

-- ============================================================
-- シフト（今週＋来週）
-- ============================================================

-- 今週（月〜日）
insert into foodai_shifts (shop_id, staff_id, date, start_time, end_time, status) values
  -- 田中（店長）今週
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 0, '10:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 1, '10:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 3, '10:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 4, '10:00', '23:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 5, '10:00', '23:00', 'confirmed'),
  -- 佐藤（ホール）今週
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 0, '11:00', '17:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 2, '11:00', '17:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 4, '17:00', '23:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 5, '11:00', '23:00', 'confirmed'),
  -- 山田（キッチン）今週
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 0, '10:30', '16:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 1, '10:30', '16:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 3, '16:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 5, '10:30', '23:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000003', date_trunc('week', current_date)::date + 6, '10:30', '16:00', 'confirmed'),
  -- 中村（ホール）今週
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000004', date_trunc('week', current_date)::date + 1, '17:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000004', date_trunc('week', current_date)::date + 2, '17:00', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000004', date_trunc('week', current_date)::date + 4, '11:00', '23:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000004', date_trunc('week', current_date)::date + 6, '11:00', '21:00', 'confirmed'),
  -- 渡辺（キッチン）今週
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000005', date_trunc('week', current_date)::date + 2, '10:30', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000005', date_trunc('week', current_date)::date + 3, '10:30', '22:00', 'confirmed'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000005', date_trunc('week', current_date)::date + 5, '16:00', '23:00', 'confirmed'),
  -- 来週ドラフト（田中・佐藤のみ）
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 7,  '10:00', '22:00', 'draft'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', date_trunc('week', current_date)::date + 8,  '10:00', '22:00', 'draft'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 7,  '11:00', '17:00', 'draft'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000002', date_trunc('week', current_date)::date + 11, '17:00', '23:00', 'draft');

-- ============================================================
-- 特別設定（来週末に臨時定員変更）
-- ============================================================
insert into foodai_slot_overrides (shop_id, date, start_time, end_time, type, capacity, note) values
  ('a1b2c3d4-0000-0000-0000-000000000001',
   date_trunc('week', current_date)::date + 12,
   '18:00', '23:00', 'custom', 30,
   '貸切パーティー対応のため定員拡大');

-- ============================================================
-- LINE会話履歴（デモ用）
-- ============================================================
insert into foodai_conversations (shop_id, line_user_id, role, content, created_at) values
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'user',      '予約したいのですが', now() - interval '2 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'assistant', 'ありがとうございます！ご予約を承ります。ご希望の日時と人数をお教えください。', now() - interval '2 hours' + interval '5 seconds'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'user',      '今日の11時半に2名で', now() - interval '1 hour 58 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'assistant', '本日11:30、2名様ですね。最後にお名前をお教えください。', now() - interval '1 hour 57 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'user',      '坂本です', now() - interval '1 hour 56 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U031', 'assistant', '坂本様、本日11:30・2名様でご予約を承りました。ご来店をお待ちしております！', now() - interval '1 hour 55 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U037', 'user',      '今夜19時に8名で予約できますか', now() - interval '3 hours'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U037', 'assistant', '19:00、8名様ですね。空席を確認いたします。', now() - interval '3 hours' + interval '5 seconds'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U037', 'assistant', 'ご予約可能です！お名前をお教えください。', now() - interval '2 hours 59 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U037', 'user',      '河野です。会社の飲み会で使います', now() - interval '2 hours 58 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U037', 'assistant', '河野様、本日19:00・8名様でご予約を承りました。会社のご宴会、楽しんでいただけますよう準備いたします！', now() - interval '2 hours 57 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U038', 'user',      '駐車場はありますか？', now() - interval '30 minutes'),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'U038', 'assistant', 'はい、店舗前に3台分の駐車スペースがございます。満車の場合は近隣コインパーキングをご利用ください。', now() - interval '29 minutes');

select '✅ デモデータの投入が完了しました' as result;
