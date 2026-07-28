-- =========================================================
-- Migration：課堂紀錄（session_logs）＋出席紀錄查詢權限
-- 1) 新增每堂課紀錄表：日期、老師、教學內容、詩歌進度、課後反饋（給下一堂老師）
-- 2) 出席紀錄查詢：同工（admin 標籤）也可讀取簽到與課堂表情
-- 適用：已執行 2026-07-27b_gathering_date.sql 的資料庫
-- =========================================================

-- 1. 課堂紀錄（每班每聚會日一筆；teacher_name 為填寫當下快照，供匯出顯示）
create table session_logs (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id),
  gathering_date date not null,
  teacher_id uuid not null default auth.uid() references profiles (id),
  teacher_name text not null default '',
  content text not null default '',        -- 教學內容
  song_progress text not null default '',  -- 詩歌進度
  feedback text not null default '',       -- 課後反饋（給下一堂的老師）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_group_id, gathering_date)
);

create index idx_session_logs_date on session_logs (gathering_date);

create or replace function public.touch_session_log()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_session_log_update
  before update on session_logs
  for each row execute function public.touch_session_log();

alter table session_logs enable row level security;

-- 老師與同工可讀（連貫性呈現全年反饋）；老師可寫
create policy "session_logs_read" on session_logs
  for select to authenticated
  using (public.has_role('teacher') or public.has_role('admin'));
create policy "session_logs_write" on session_logs
  for all to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));

-- 2. 出席紀錄查詢：同工（admin）也需讀取當日紀錄與課堂表情
drop policy "check_ins_read" on check_ins;
create policy "check_ins_read" on check_ins
  for select to authenticated
  using (public.has_role('teacher') or public.has_role('admin'));

drop policy "feedback_read" on session_feedback;
create policy "feedback_read" on session_feedback
  for select to authenticated
  using (
    public.has_role('teacher')
    or public.has_role('admin')
    or child_id in (select public.my_child_ids())
  );
