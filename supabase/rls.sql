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

-- weekly_songs（v11 #1）：全員可讀（家長要預習下次的歌）；同工維護
alter table weekly_songs enable row level security;
create policy "weekly_songs_read" on weekly_songs
  for select to authenticated using (public.is_approved());
create policy "weekly_songs_write" on weekly_songs
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

-- ---- 家長端「組織架構的班別老師名單」與「孩子上過的課程」（v10 #1/#2）----
-- 個資紅線：兩個函式**只回傳稱呼（display_name）**，不回傳 email/phone；
-- profiles 的 RLS（本人或 admin 可讀）維持不動，家長拿不到老師的聯絡方式。

-- 我綁定的孩子所屬班別（家長端授權範圍的單一來源）
create or replace function public.my_child_class_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct c.class_group_id
  from children c
  where c.id in (select public.my_child_ids())
$$;

-- 班別老師名單：同工看全部班別，家長只看自己孩子的班別
create or replace function public.class_teachers()
returns table (class_group_id uuid, teacher_name text)
language sql stable security definer set search_path = public
as $$
  select tca.class_group_id, p.display_name
  from teacher_class_assignments tca
  join profiles p on p.id = tca.teacher_id
  where public.is_approved()
    and p.approved                              -- 未審核的老師不列入名單
    and (
      public.is_staff()
      or tca.class_group_id in (select public.my_child_class_ids())
    )
  order by tca.class_group_id, p.display_name
$$;
grant execute on function public.class_teachers() to authenticated;

-- 家長版簡易教案：只回「已經上過的課」＋孩子所屬班別；幼幼班無教案模組（v4 決議 8）。
-- 欄位只給「項目 / 內容 / 帶班老師」——時間、教材預備、課後執行屬同工內部欄位，不外流。
create or replace function public.parent_lesson_segments(from_date date, to_date date)
returns table (
  class_group_id uuid,
  gathering_date date,
  sort_order int,
  item text,
  content text,
  teacher_name text
)
language sql stable security definer set search_path = public
as $$
  select s.class_group_id, s.gathering_date, s.sort_order, s.item, s.content, s.teacher_text
  from lesson_segments s
  join class_groups g on g.id = s.class_group_id
  where public.is_approved()
    and s.class_group_id in (select public.my_child_class_ids())
    and g.name not like '%幼幼%'
    and s.gathering_date >= from_date
    and s.gathering_date <= least(to_date, current_date) -- 未來的課不預告，避免變成進度壓力
  order by s.gathering_date desc, s.sort_order
$$;
grant execute on function public.parent_lesson_segments(date, date) to authenticated;

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

-- ---- 兒童服事（Sprint 04 Wave 1b）----
-- 服事資格開關：該班老師或同工（security definer；不放寬 children 寫入權）
create or replace function public.set_child_service_eligible(cid uuid, flag boolean)
returns void
language sql security definer set search_path = public
as $$
  update children set service_eligible = flag
  where id = cid
    and (public.is_admin() or public.child_in_my_class(cid));
$$;
grant execute on function public.set_child_service_eligible(uuid, boolean) to authenticated;

-- child_service_items（v11 #4）：老師與家長可檢視項目與說明；同工可維護
alter table child_service_items enable row level security;
create policy "child_service_items_read" on child_service_items
  for select to authenticated using (public.is_approved());
create policy "child_service_items_write" on child_service_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table child_service_signups enable row level security;
create policy "child_signups_read" on child_service_signups
  for select to authenticated
  using (public.is_staff() or child_id in (select public.my_child_ids()));
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

-- ---- 教學模組（Sprint 04 Wave 2）----
alter table lesson_segments enable row level security;
create policy "lesson_segments_read" on lesson_segments
  for select to authenticated using (public.is_staff());
create policy "lesson_segments_write" on lesson_segments
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));

alter table class_docs enable row level security;
create policy "class_docs_read" on class_docs
  for select to authenticated using (public.is_staff());
create policy "class_docs_write" on class_docs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table materials enable row level security;
create policy "materials_read" on materials
  for select to authenticated using (public.is_staff());
create policy "materials_insert" on materials
  for insert to authenticated with check (public.is_staff());
create policy "materials_update" on materials
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy "materials_delete" on materials
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---- 會議與行政（Sprint 04 Wave 3）----
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

-- meeting_links（v11 #11）：讀寫完全跟著母會議走，不重複實作 scope/班別判斷
alter table meeting_links enable row level security;
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
create policy "meeting_links_write" on meeting_links
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table org_units enable row level security;
create policy "org_units_read" on org_units
  for select to authenticated using (public.is_staff());
create policy "org_units_write" on org_units
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
