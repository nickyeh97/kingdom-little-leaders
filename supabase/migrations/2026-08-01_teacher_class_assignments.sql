-- =========================================================
-- Migration：老師標籤班別化（Sprint 03 地基，規格書 v3 決議 3）
-- roles 保留 'teacher'，新增 老師×班別 關聯；點名/日誌/表情回饋的
-- 「寫入」權限收緊為該班老師（讀取範圍待組長詳細版，暫不變）
-- 既有老師先預設指派全部班別，由管理者於名單頁收斂
-- 適用：已執行 2026-07-31_member_approval.sql 的資料庫
-- =========================================================

create table teacher_class_assignments (
  teacher_id uuid not null references profiles (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  primary key (teacher_id, class_group_id)
);

-- 既有老師：預設指派全部班別（管理者再收斂）
insert into teacher_class_assignments (teacher_id, class_group_id)
select p.id, cg.id
from profiles p
cross join class_groups cg
where 'teacher' = any (p.roles);

-- 是否為某班別的老師（含審核檢查：未審核者 my_roles() 為空 → false）
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

-- 孩子所屬班別是否為我的班（點名/表情回饋用）
create or replace function public.child_in_my_class(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from children c
    where c.id = cid and public.has_class_role(c.class_group_id)
  )
$$;

alter table teacher_class_assignments enable row level security;

-- 指派表：登入者可讀（名單頁顯示「＊＊班老師」標籤）；管理者可寫
create policy "tca_read" on teacher_class_assignments
  for select to authenticated using (true);
create policy "tca_write" on teacher_class_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- 寫入權限收緊為「該班老師」 ----

-- check_ins：寫入需為該孩子班別的老師（讀取維持老師/同工）
drop policy "check_ins_insert" on check_ins;
drop policy "check_ins_update" on check_ins;
drop policy "check_ins_delete" on check_ins;
create policy "check_ins_insert" on check_ins
  for insert to authenticated with check (public.child_in_my_class(child_id));
create policy "check_ins_update" on check_ins
  for update to authenticated
  using (public.child_in_my_class(child_id)) with check (public.child_in_my_class(child_id));
create policy "check_ins_delete" on check_ins
  for delete to authenticated using (public.child_in_my_class(child_id));

-- session_feedback：寫入需為該孩子班別的老師
drop policy "feedback_write" on session_feedback;
create policy "feedback_write" on session_feedback
  for all to authenticated
  using (public.child_in_my_class(child_id)) with check (public.child_in_my_class(child_id));

-- session_logs：寫入需為該班別的老師
drop policy "session_logs_write" on session_logs;
create policy "session_logs_write" on session_logs
  for all to authenticated
  using (public.has_class_role(class_group_id)) with check (public.has_class_role(class_group_id));
