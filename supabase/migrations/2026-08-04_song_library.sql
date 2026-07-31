-- Sprint 03 #5：詩歌曲庫重構（v4 決議 3/4＋現行共編 Excel 欄位基準）
-- 於 Supabase SQL Editor 執行。
--
-- 模型依（兒童班）敬拜歌單 Excel：
--   雙月固定歌單（月份、歌名、連結1有動作、連結2純歌詞）＝ song_playlists＋playlist_songs
--   敬拜過的歌單（歌名、歌唱/動作熟悉指數 1~5、填寫人、填寫日期、上課日期）＝ song_familiarity

-- 1) songs 曲庫化：不再綁定單一聚會日；
--    youtube_url＝連結（純歌詞）、dance_url＝連結（有動作）
alter table songs add column if not exists dance_url text;
alter table songs alter column gathering_date drop not null;

-- 2) 歌單期間（班別 × 期間，如「2026年7-8月」雙月歌單；v4 決議 4：以班別區分）
create table if not exists song_playlists (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  title text not null,             -- 例：2026年7-8月
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (class_group_id, title)
);

create table if not exists playlist_songs (
  playlist_id uuid not null references song_playlists (id) on delete cascade,
  song_id uuid not null references songs (id) on delete cascade,
  sort_order int not null default 0,
  primary key (playlist_id, song_id)
);

-- 3) 兩維熟悉度（班別 × 歌曲；歌唱/動作各 1–5：1＝不熟、5＝熟悉——v4 決議 3）
--    記錄於詩歌曲目上；老師可於詩歌頁直接編輯、也可於課堂紀錄（日誌）流程覆寫；
--    幼幼班不需填寫。填寫人以快照存名（避免互查 profiles 的權限問題）
create table if not exists song_familiarity (
  song_id uuid not null references songs (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  song_level smallint check (song_level between 1 and 5),     -- 歌唱熟悉指數
  motion_level smallint check (motion_level between 1 and 5), -- 動作熟悉指數
  last_practiced_on date,                                     -- 上課日期（最近練習）
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_by_name text not null default '',                   -- 填寫人（快照）
  updated_at timestamptz not null default now(),              -- 填寫日期
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

-- 4) 既有歌曲搬遷：各班建立一份「2026年8月」歌單，收納現有全部歌曲（管理者可再調整）
--    幼幼班無詩歌模組（只有點名＋課後紀錄）——不建歌單
insert into song_playlists (class_group_id, title, start_date, end_date)
select cg.id, '2026年8月', date '2026-08-01', date '2026-08-31'
from class_groups cg
where cg.name not like '%幼幼%'
on conflict do nothing;

insert into playlist_songs (playlist_id, song_id, sort_order)
select pl.id, s.id, coalesce(s.sort_order, 0)
from song_playlists pl
cross join songs s
where pl.title = '2026年8月'
on conflict do nothing;

-- 5) RLS
alter table song_playlists enable row level security;
create policy "song_playlists_read" on song_playlists
  for select to authenticated using (public.is_approved());
create policy "song_playlists_write" on song_playlists
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table playlist_songs enable row level security;
create policy "playlist_songs_read" on playlist_songs
  for select to authenticated using (public.is_approved());
create policy "playlist_songs_write" on playlist_songs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table song_familiarity enable row level security;
create policy "song_familiarity_read" on song_familiarity
  for select to authenticated using (public.is_approved());
-- 由「該班老師」填寫（詩歌頁或日誌流程）；同工可代為修正
create policy "song_familiarity_write" on song_familiarity
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));
