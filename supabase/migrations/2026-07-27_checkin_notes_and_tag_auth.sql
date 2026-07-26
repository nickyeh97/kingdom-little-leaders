-- =========================================================
-- Migration：點名頁整合＋admin 逐標籤授權
-- 1) 預先出席加「給老師的話」備註
-- 2) 點名改為當日紀錄：出席/臨時請假 狀態＋課堂紀錄（僅老師可見）
-- 3) check_ins 權限改為僅「老師標籤」（admin 不再自動放行）
-- 適用：已執行 2026-07-26_multi_roles.sql 的資料庫
-- =========================================================

-- 1. 預先出席備註（家長填，老師點名時可見）
alter table attendance_plans add column note text;

-- 2. 點名 = 當日紀錄：狀態（簽到/臨時請假）＋課堂紀錄
--    課堂紀錄屬高敏感內容：僅老師標籤可讀寫，不對家長端顯示（守則紅燈 #7）
create type checkin_status as enum ('present', 'leave');
alter table check_ins add column status checkin_status not null default 'present';
alter table check_ins add column note text;

-- 2b. 課堂表現回饋：老師以「表情」向家長說明課堂情況（取代成績）
--     家長僅能看到自己孩子的回饋；表情選項於前端維護（正向/關懷取向）
create table session_feedback (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  sunday_date date not null,
  moods text[] not null default '{}',
  created_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  unique (child_id, sunday_date)
);

alter table session_feedback enable row level security;

create policy "feedback_read" on session_feedback
  for select to authenticated
  using (public.has_role('teacher') or child_id in (select public.my_child_ids()));
create policy "feedback_write" on session_feedback
  for all to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));

-- 3. check_ins 權限：僅老師標籤（逐標籤授權，admin 需另具老師標籤才可點名）
drop policy "check_ins_read" on check_ins;
drop policy "check_ins_insert" on check_ins;
drop policy "check_ins_delete" on check_ins;

create policy "check_ins_read" on check_ins
  for select to authenticated using (public.has_role('teacher'));
create policy "check_ins_insert" on check_ins
  for insert to authenticated with check (public.has_role('teacher'));
create policy "check_ins_update" on check_ins
  for update to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));
create policy "check_ins_delete" on check_ins
  for delete to authenticated using (public.has_role('teacher'));
