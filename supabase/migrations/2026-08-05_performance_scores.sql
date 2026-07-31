-- PRD v2.0 決議（v4 決議 2）：專心/配合指數改版
-- 於 Supabase SQL Editor 執行（在 2026-08-04_song_library.sql 之後）。
--
-- 變更內容：
-- 1. 指數拆為「專心度」「配合度」兩維，數值 1–5（下拉預設 5）
-- 2. 僅老師與同工（admin）可讀——家長不可見（推翻 v3 的家長可見）
--    因 session_feedback（表情標籤）維持家長可見，指數必須拆到獨立資料表
-- 3. 老師端可調閱近三個月走勢（含出席與老師備註）

create table if not exists performance_scores (
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  focus smallint check (focus between 1 and 5),        -- 專心度
  cooperation smallint check (cooperation between 1 and 5), -- 配合度
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (child_id, gathering_date)
);
create index if not exists idx_perf_scores_date on performance_scores (gathering_date);

-- upsert 的 update 分支不會套用 default → 觸發器補刷新
create or replace function public.touch_performance_scores()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_touch_performance_scores on performance_scores;
create trigger trg_touch_performance_scores before update on performance_scores
  for each row execute function public.touch_performance_scores();

alter table performance_scores enable row level security;
-- 讀：僅老師與同工（家長不可見——v4 決議 2）
create policy "perf_scores_read" on performance_scores
  for select to authenticated using (public.is_staff());
-- 寫：該班老師（班別化授權）
create policy "perf_scores_write" on performance_scores
  for all to authenticated
  using (public.child_in_my_class(child_id))
  with check (public.child_in_my_class(child_id));

-- 移除 08-02 加在 session_feedback 的單維 engagement（尚未累積正式資料）
alter table session_feedback drop column if exists engagement;

-- 備註：08-02 的 parent_checkin_marks() 函式保留不動（家長端出席勾勾預留，前端暫停使用）
