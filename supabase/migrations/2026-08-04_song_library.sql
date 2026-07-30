-- Sprint 03 #5：詩歌曲庫重構（規格書 v3 決議 5）
-- 於 Supabase SQL Editor 執行。

-- 1) songs 曲庫化：不再綁定單一聚會日（可一次上傳整學期，越新越上面）；
--    新增「詩歌舞蹈」影片連結（youtube_url＝詩歌、dance_url＝詩歌舞蹈）
alter table songs add column if not exists dance_url text;
alter table songs alter column gathering_date drop not null;

-- 2) 歌單排程（班別 × 聚會日）：「本週＊＊班的詩歌」「下週＊＊班的詩歌」由日期推導
create table if not exists song_schedule (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  gathering_date date not null,
  unique (song_id, class_group_id, gathering_date)
);
create index if not exists idx_song_schedule_date on song_schedule (gathering_date);

-- 3) 兩維熟悉度（班別 × 歌曲；「歌曲」與「動作」各 1–3：陌生/練習中/熟悉）
--    是班級整體的練習進度，不評比個別孩子；幼幼班老師不需填寫（前端不顯示）
create table if not exists song_familiarity (
  song_id uuid not null references songs (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  song_level smallint check (song_level between 1 and 3),
  motion_level smallint check (motion_level between 1 and 3),
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (song_id, class_group_id)
);

-- upsert 的 update 分支不會套用 default → 觸發器補刷新
create or replace function public.touch_song_familiarity()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_touch_song_familiarity on song_familiarity;
create trigger trg_touch_song_familiarity before update on song_familiarity
  for each row execute function public.touch_song_familiarity();

-- 4) 既有歌曲搬遷：原「每週歌單」為全班共用 → 轉為三班排程（保留歷史）
insert into song_schedule (song_id, class_group_id, gathering_date)
select s.id, cg.id, s.gathering_date
from songs s cross join class_groups cg
where s.gathering_date is not null
on conflict do nothing;

-- 5) RLS
alter table song_schedule enable row level security;
create policy "song_schedule_read" on song_schedule
  for select to authenticated using (public.is_approved());
create policy "song_schedule_write" on song_schedule
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table song_familiarity enable row level security;
create policy "song_familiarity_read" on song_familiarity
  for select to authenticated using (public.is_approved());
-- 於日誌流程由「該班老師」填寫；同工可代為修正
create policy "song_familiarity_write" on song_familiarity
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));
