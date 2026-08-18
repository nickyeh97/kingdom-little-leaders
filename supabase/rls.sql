-- =========================================================
-- Row Level Security：權限規則在資料庫層強制執行
-- 原則（見 CLAUDE.md）：
--   * 家長只能看到/操作自己綁定的孩子
--   * 老師可讀名單與出席、寫簽到
--   * 管理者全權
--   * 前端的角色判斷只是 UX，不是安全邊界
-- =========================================================

-- ---- 輔助函式（security definer 繞過 RLS 讀 profiles，避免遞迴）----
create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select approved from profiles where id = auth.uid()), false)
$$;

-- 未審核者視同無任何角色標籤（審核機制：僅能看公告與帳號設定）
create or replace function public.my_roles()
returns user_role[]
language sql stable security definer set search_path = public
as $$
  select case when approved then roles else '{}'::user_role[] end
  from profiles where id = auth.uid()
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

-- 是否為某班別的老師（老師標籤班別化）
create or replace function public.has_class_role(cg uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('teacher')
     and exists (
       select 1 from teacher_class_assignments
       where teacher_id = auth.uid() and class_group_id = cg
     )
$$;

create or replace function public.child_in_my_class(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from children c
    where c.id = cid and public.has_class_role(c.class_group_id)
  )
$$;

create or replace function public.my_child_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select child_id from family_links
  where parent_id = auth.uid() and public.is_approved()
$$;

-- ---- 啟用 RLS ----
alter table class_groups enable row level security;
alter table profiles enable row level security;
alter table children enable row level security;
alter table family_links enable row level security;
alter table attendance_plans enable row level security;
alter table check_ins enable row level security;
alter table announcements enable row level security;

-- ---- teacher_class_assignments：登入者可讀（顯示班別老師標籤）；管理者可寫 ----
alter table teacher_class_assignments enable row level security;
create policy "tca_read" on teacher_class_assignments
  for select to authenticated using (true);
create policy "tca_write" on teacher_class_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

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
    -- 非管理者不得改自己的 roles 與 approved（防止自我提權/自我審核）
    public.is_admin()
    or (
      id = auth.uid()
      and roles = (select p.roles from profiles p where p.id = auth.uid())
      and approved = (select p.approved from profiles p where p.id = auth.uid())
    )
  );

-- 刪除成員：僅管理者、且不得刪除自己
create policy "profiles_delete_admin" on profiles
  for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

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
-- 寫入依「點名所屬班別」：本班老師可將全校名冊上的孩子加入本班當日（現場加入）
create policy "check_ins_insert" on check_ins
  for insert to authenticated with check (public.has_class_role(class_group_id));
create policy "check_ins_update" on check_ins
  for update to authenticated
  using (public.has_class_role(class_group_id)) with check (public.has_class_role(class_group_id));
create policy "check_ins_delete" on check_ins
  for delete to authenticated using (public.has_class_role(class_group_id));

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
  using (public.child_in_my_class(child_id)) with check (public.child_in_my_class(child_id));

-- ---- session_logs：老師與同工可讀（全年反饋連貫呈現）；老師可寫 ----
alter table session_logs enable row level security;
create policy "session_logs_read" on session_logs
  for select to authenticated
  using (public.has_role('teacher') or public.has_role('admin'));
create policy "session_logs_write" on session_logs
  for all to authenticated
  using (public.has_class_role(class_group_id)) with check (public.has_class_role(class_group_id));

-- ---- songs：所有登入者可讀（家長預習/老師預備）；管理者可寫 ----
alter table songs enable row level security;
create policy "songs_read" on songs
  for select to authenticated using (public.is_approved()); -- 未審核者僅剩公告
create policy "songs_write" on songs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- announcements：所有登入者可讀；同工可寫全部、各班老師僅能寫自己班別（v3 決議 4）----
create policy "announcements_read" on announcements
  for select to authenticated using (true);
create policy "announcements_admin_write" on announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "announcements_teacher_write" on announcements
  for all to authenticated
  using (class_group_id is not null and public.has_class_role(class_group_id))
  with check (class_group_id is not null and public.has_class_role(class_group_id));

-- ---- performance_scores（v4 決議 2）：僅老師/同工可讀；該班老師可寫 ----
alter table performance_scores enable row level security;
create policy "perf_scores_read" on performance_scores
  for select to authenticated using (public.is_staff());
create policy "perf_scores_write" on performance_scores
  for all to authenticated
  using (public.child_in_my_class(child_id))
  with check (public.child_in_my_class(child_id));

-- ---- song_playlists / playlist_songs / song_familiarity（v4 決議 3/4）----
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
create policy "song_familiarity_write" on song_familiarity
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));

-- ---- 家長端「出席勾勾」（v3 決議 2 / Figma S3 幼幼班走勢）----
-- 只回傳自己綁定孩子的簽到「狀態」；check_ins 的 note（老師交接備註）
-- 僅老師可見的決議不變——本函式刻意不 select note 欄位。
create or replace function public.parent_checkin_marks(from_date date, to_date date)
returns table (child_id uuid, gathering_date date, status checkin_status)
language sql stable security definer set search_path = public
as $$
  select c.child_id, c.gathering_date, c.status
  from check_ins c
  where c.child_id in (select public.my_child_ids())
    and c.gathering_date between from_date and to_date
$$;

grant execute on function public.parent_checkin_marks(date, date) to authenticated;

-- ---- 服事排班（Sprint 04 Wave 1a）----
alter table service_weeks enable row level security;
create policy "service_weeks_read" on service_weeks
  for select to authenticated
  using (public.is_admin() or (public.is_staff() and published));
create policy "service_weeks_write" on service_weeks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table teacher_service_signups enable row level security;
create policy "signups_read" on teacher_service_signups
  for select to authenticated using (public.is_staff());
create policy "signups_insert" on teacher_service_signups
  for insert to authenticated
  with check (
    public.is_admin()
    or (teacher_id = auth.uid() and public.has_class_role(class_group_id))
  );
create policy "signups_delete" on teacher_service_signups
  for delete to authenticated
  using (public.is_admin() or teacher_id = auth.uid());

alter table service_assignments enable row level security;
create policy "assignments_read" on service_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and exists (
      select 1 from service_weeks w
      where w.id = service_week_id and w.published
    ))
  );
create policy "assignments_write" on service_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
