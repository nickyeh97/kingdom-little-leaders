-- =========================================================
-- Row Level Security：權限規則在資料庫層強制執行
-- 原則（見 CLAUDE.md）：
--   * 家長只能看到/操作自己綁定的孩子
--   * 老師可讀名單與出席、寫簽到
--   * 管理者全權
--   * 前端的角色判斷只是 UX，不是安全邊界
-- =========================================================

-- ---- 輔助函式（security definer 繞過 RLS 讀 profiles，避免遞迴）----
create or replace function public.my_roles()
returns user_role[]
language sql stable security definer set search_path = public
as $$
  select roles from profiles where id = auth.uid()
$$;

create or replace function public.has_role(r user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select r = any (coalesce(public.my_roles(), '{}'))
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin')
$$;

create or replace function public.is_staff() -- 具老師或管理者標籤
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin') or public.has_role('teacher')
$$;

create or replace function public.my_child_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select child_id from family_links where parent_id = auth.uid()
$$;

-- ---- 啟用 RLS ----
alter table class_groups enable row level security;
alter table profiles enable row level security;
alter table children enable row level security;
alter table family_links enable row level security;
alter table attendance_plans enable row level security;
alter table check_ins enable row level security;
alter table announcements enable row level security;

-- ---- class_groups：登入者可讀，管理者可寫 ----
create policy "class_groups_read" on class_groups
  for select to authenticated using (true);
create policy "class_groups_write" on class_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- profiles：本人與管理者可讀；本人可改名字、管理者可改角色 ----
create policy "profiles_read_self" on profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_update_self" on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    -- 非管理者不得改自己的 roles（防止自我提權）
    public.is_admin() or (id = auth.uid() and roles = (select p.roles from profiles p where p.id = auth.uid()))
  );

-- ---- children：老師/管理者可讀全部；家長只讀自己綁定的；管理者可寫 ----
create policy "children_read" on children
  for select to authenticated
  using (public.is_staff() or id in (select public.my_child_ids()));
create policy "children_write" on children
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- family_links：本人與管理者可讀；管理者可寫 ----
create policy "family_links_read" on family_links
  for select to authenticated using (parent_id = auth.uid() or public.is_admin());
create policy "family_links_write" on family_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- attendance_plans：家長讀寫自己孩子的；老師/管理者可讀全部與代填 ----
create policy "plans_read" on attendance_plans
  for select to authenticated
  using (public.is_staff() or child_id in (select public.my_child_ids()));
create policy "plans_insert" on attendance_plans
  for insert to authenticated
  with check (public.is_staff() or child_id in (select public.my_child_ids()));
create policy "plans_update" on attendance_plans
  for update to authenticated
  using (public.is_staff() or child_id in (select public.my_child_ids()))
  with check (public.is_staff() or child_id in (select public.my_child_ids()));
create policy "plans_delete" on attendance_plans
  for delete to authenticated using (public.is_admin());

-- ---- check_ins：老師可寫；老師與同工（admin）可讀（出席紀錄查詢）；
--      老師備註不對家長開放 ----
create policy "check_ins_read" on check_ins
  for select to authenticated
  using (public.has_role('teacher') or public.has_role('admin'));
create policy "check_ins_insert" on check_ins
  for insert to authenticated with check (public.has_role('teacher'));
create policy "check_ins_update" on check_ins
  for update to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));
create policy "check_ins_delete" on check_ins
  for delete to authenticated using (public.has_role('teacher'));

-- ---- session_feedback：老師可寫；老師/同工與孩子的家長可讀 ----
alter table session_feedback enable row level security;
create policy "feedback_read" on session_feedback
  for select to authenticated
  using (
    public.has_role('teacher')
    or public.has_role('admin')
    or child_id in (select public.my_child_ids())
  );
create policy "feedback_write" on session_feedback
  for all to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));

-- ---- session_logs：老師與同工可讀（全年反饋連貫呈現）；老師可寫 ----
alter table session_logs enable row level security;
create policy "session_logs_read" on session_logs
  for select to authenticated
  using (public.has_role('teacher') or public.has_role('admin'));
create policy "session_logs_write" on session_logs
  for all to authenticated
  using (public.has_role('teacher')) with check (public.has_role('teacher'));

-- ---- announcements：所有登入者可讀；管理者可寫 ----
create policy "announcements_read" on announcements
  for select to authenticated using (true);
create policy "announcements_write" on announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
