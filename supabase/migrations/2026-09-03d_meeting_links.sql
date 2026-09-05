-- v11 #11：開會決議可掛多個連結（講義、簡報、錄影…）
--
-- 沿用 CLAUDE.md 決議 11（圖片/檔案不自建儲存）：檔案放教會 NAS/Google 雲端，
-- 平台只存「標題＋網址」外連。一場會議可掛多筆。
--
-- 於 Supabase SQL Editor 執行；可重複執行（冪等）。

create table if not exists meeting_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  title text not null,                  -- 例：兒童牧區研習會講義
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_meeting_links on meeting_links (meeting_id, sort_order);

alter table meeting_links enable row level security;

-- 讀寫權限完全跟著母會議走（scope/班別的判斷不重複實作，避免兩處走鐘）
drop policy if exists "meeting_links_read" on meeting_links;
create policy "meeting_links_read" on meeting_links
  for select to authenticated
  using (
    exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (
          public.is_admin()
          or (public.is_staff() and m.scope = 'all')
          or (m.scope = 'class' and public.has_class_role(m.class_group_id))
        )
    )
  );

drop policy if exists "meeting_links_write" on meeting_links;
create policy "meeting_links_write" on meeting_links
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
