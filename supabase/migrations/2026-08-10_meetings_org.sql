-- Sprint 04 Wave 3：會議與行政（T-COM-04、C-05、C-06；T-KID-09 班別會議一併支援）
-- 於 Supabase SQL Editor 執行。
--
-- 設計備忘：
-- - 會議 scope：all＝全體老師大會（老師可查閱決議 T-COM-04）、
--   staff＝核心同工會議（僅同工可見 C-05）、class＝班別會議（該班老師可見）
-- - C-05 結構化：會議紀錄＋事項（決議/待討論）追蹤——內容、分工、
--   預計完成日期、狀態（待辦/進行中/已完成）
-- - 分工與建立者姓名以快照存欄

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('all', 'staff', 'class')),
  class_group_id uuid references class_groups (id) on delete cascade, -- scope=class 時必填
  meeting_date date not null,
  title text not null,
  minutes text not null default '',  -- 會議紀錄
  created_by uuid not null default auth.uid() references profiles (id),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_meetings_date on meetings (meeting_date desc);

-- 事項追蹤（決議事項／分工表／待討論狀態）
create table if not exists meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  content text not null,
  assignee text not null default '',   -- 分工（姓名文字）
  due_date date,                        -- 預計完成日期
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  sort_order int not null default 0
);
create index if not exists idx_meeting_items on meeting_items (meeting_id);

-- 組織架構／分工（C-06：組別、職務與名單；先開放老師/同工檢視，家長端為藍標）
create table if not exists org_units (
  id uuid primary key default gen_random_uuid(),
  title text not null,                 -- 組別/職務（如：兒主窗口、敬拜組）
  members_text text not null default '', -- 名單（文字）
  note text not null default '',
  sort_order int not null default 0
);

-- ---- RLS ----
alter table meetings enable row level security;
create policy "meetings_read" on meetings
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and scope = 'all')
    or (scope = 'class' and public.has_class_role(class_group_id))
  );
create policy "meetings_write" on meetings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table meeting_items enable row level security;
create policy "meeting_items_read" on meeting_items
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
create policy "meeting_items_write" on meeting_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table org_units enable row level security;
create policy "org_units_read" on org_units
  for select to authenticated using (public.is_staff());
create policy "org_units_write" on org_units
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
