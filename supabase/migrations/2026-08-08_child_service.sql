-- Sprint 04 Wave 1b：兒童服事（P-03/P-04/P-05、C-02、T-KID-01）
-- 於 Supabase SQL Editor 執行。
--
-- 設計備忘：
-- - 服事資格（P-03）＝ children.service_eligible；開關走 security definer RPC，
--   授權「該班老師或同工」（PRD 進階功能），不放寬 children 整列的寫入權
-- - 兒童服事表與老師服事表分開發布（child_service_rosters.published）
-- - 姓名以快照存欄；集點卡（藍標）之後可直接彙整 assignments 成服事經歷

-- 1) 服事資格（P-03）
alter table children
  add column if not exists service_eligible boolean not null default false;

create or replace function public.set_child_service_eligible(cid uuid, flag boolean)
returns void
language sql security definer set search_path = public
as $$
  update children set service_eligible = flag
  where id = cid
    and (public.is_admin() or public.child_in_my_class(cid));
$$;
grant execute on function public.set_child_service_eligible(uuid, boolean) to authenticated;

-- 2) 兒童服事報名（P-04：家長為符合資格的孩子勾選日期×項目）
create table if not exists child_service_signups (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  item text not null,
  note text,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now(),
  unique (child_id, gathering_date, item)
);
create index if not exists idx_child_signups_date on child_service_signups (gathering_date);

-- 3) 兒童服事表（C-02：同工依報名排班；發布後家長/老師可見）
create table if not exists child_service_rosters (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gathering_date, class_group_id)
);
create index if not exists idx_child_rosters_date on child_service_rosters (gathering_date);

create table if not exists child_service_assignments (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references child_service_rosters (id) on delete cascade,
  child_id uuid references children (id) on delete set null,
  child_name text not null default '',  -- 快照（顯示/匯出）
  item text not null,
  sort_order int not null default 0
);
create index if not exists idx_child_assignments_roster
  on child_service_assignments (roster_id);

-- ---- RLS ----
alter table child_service_signups enable row level security;
-- 老師/同工全看；家長看自己孩子的報名
create policy "child_signups_read" on child_service_signups
  for select to authenticated
  using (public.is_staff() or child_id in (select public.my_child_ids()));
-- 家長為「自己綁定且具服事資格」的孩子報名；同工可代填
create policy "child_signups_insert" on child_service_signups
  for insert to authenticated
  with check (
    exists (select 1 from children c where c.id = child_id and c.service_eligible)
    and (public.is_admin() or child_id in (select public.my_child_ids()))
  );
create policy "child_signups_delete" on child_service_signups
  for delete to authenticated
  using (public.is_admin() or child_id in (select public.my_child_ids()));

alter table child_service_rosters enable row level security;
-- 已發布：審核通過者皆可看（P-05 家長/兒童、T-KID-01 老師）；同工全看
create policy "child_rosters_read" on child_service_rosters
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and published));
create policy "child_rosters_write" on child_service_rosters
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table child_service_assignments enable row level security;
create policy "child_assignments_read" on child_service_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_approved() and exists (
      select 1 from child_service_rosters r
      where r.id = roster_id and r.published
    ))
  );
create policy "child_assignments_write" on child_service_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
