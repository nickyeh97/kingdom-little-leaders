-- v11：本週歌單排到聚會日（#1）、課堂紀錄兩維指數（#5）、兒童服事項目字典（#4）
-- 於 Supabase SQL Editor 執行；整支可重複執行（冪等）。

-- ============================================================
-- #1 本週歌單排到聚會日
-- ------------------------------------------------------------
-- 原本的 playlist_songs.is_weekly 只是「現在這一次」的勾選，沒有日期，
-- 所以家長端看不到「那天到底唱了什麼」，也分不出「這週上過的」與「下次要上的」。
-- 改為把歌曲排到具體聚會日：教案頁取該日、詩歌頁取下次聚會日。
-- is_weekly 欄位保留不動（不刪資料），但已不再使用。
create table if not exists weekly_songs (
  class_group_id uuid not null references class_groups (id) on delete cascade,
  gathering_date date not null,
  song_id uuid not null references songs (id) on delete cascade,
  sort_order int not null default 0,
  primary key (class_group_id, gathering_date, song_id)
);
create index if not exists idx_weekly_songs_date on weekly_songs (gathering_date, class_group_id);

alter table weekly_songs enable row level security;
drop policy if exists "weekly_songs_read" on weekly_songs;
create policy "weekly_songs_read" on weekly_songs
  for select to authenticated using (public.is_approved()); -- 家長要預習，全員可讀
drop policy if exists "weekly_songs_write" on weekly_songs;
create policy "weekly_songs_write" on weekly_songs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());  -- 與 song_playlists 一致：同工維護

-- ============================================================
-- #5 課堂紀錄新增「流程順暢度」「學生配合度」
-- ------------------------------------------------------------
-- 點名頁的專心度/配合度（performance_scores）僅從介面移除，**資料一律保留**，
-- 之後組長給完整需求再決定去留（不做不可逆的刪除）。
alter table session_logs
  add column if not exists flow_score smallint,
  add column if not exists cooperation_score smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_logs_flow_score_check') then
    alter table session_logs
      add constraint session_logs_flow_score_check
      check (flow_score is null or flow_score between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_logs_cooperation_score_check') then
    alter table session_logs
      add constraint session_logs_cooperation_score_check
      check (cooperation_score is null or cooperation_score between 1 and 5);
  end if;
end $$;

-- ============================================================
-- #4 兒童服事項目字典（名稱＋說明，同工可維護）
-- ------------------------------------------------------------
-- 原本六項寫死在前端常數，改為資料表：新增/改名/改說明會同步到
-- 逐項授權（名單頁）與報名勾選（服事頁）的所有按鈕。
create table if not exists child_service_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- 也是 child_service_* 各表 item 欄位的值
  description text not null default '',
  sort_order int not null default 0,
  active boolean not null default true, -- 停用＝不再出現在新的勾選，既有紀錄不動
  created_at timestamptz not null default now()
);

alter table child_service_items enable row level security;
drop policy if exists "child_service_items_read" on child_service_items;
create policy "child_service_items_read" on child_service_items
  for select to authenticated using (public.is_approved()); -- 老師與家長皆可檢視項目說明
drop policy if exists "child_service_items_write" on child_service_items;
create policy "child_service_items_write" on child_service_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 帶入 2026-08-27 定案的六項（既有紀錄的 item 文字與此一致，不需搬移）
insert into child_service_items (name, sort_order) values
  ('收奉獻', 1),
  ('敬拜-司琴', 2),
  ('敬拜-小樂器', 3),
  ('敬拜-Vocal', 4),
  ('領讀天使-宣言/讀經/禱告', 5),
  ('環境稽核', 6)
on conflict (name) do nothing;

notify pgrst, 'reload schema';
