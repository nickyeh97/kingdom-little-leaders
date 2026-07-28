-- =========================================================
-- Migration：敬拜歌單（songs）
-- 每聚會日一組歌單（約 4 首）：歌名、YouTube 連結、歌詞；
-- 影音一律外連 YouTube，不自建儲存（CLAUDE.md 技術原則）
-- 適用：已執行 2026-07-28_session_logs_records.sql 的資料庫
-- =========================================================

create table songs (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,   -- 這首歌屬於哪一週的歌單
  title text not null,
  youtube_url text,
  lyrics text,
  sort_order int not null default 0,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_songs_date on songs (gathering_date);

alter table songs enable row level security;

-- 所有登入者可讀（家長預習、老師預備）；管理者可寫
create policy "songs_read" on songs
  for select to authenticated using (true);
create policy "songs_write" on songs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
