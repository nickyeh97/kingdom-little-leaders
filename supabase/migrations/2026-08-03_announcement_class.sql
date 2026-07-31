-- Sprint 03 #4：公告班別化（規格書 v3 決議 4）
-- 於 Supabase SQL Editor 執行。

-- 1) 公告新增班別歸屬：null＝全體公告
alter table announcements
  add column if not exists class_group_id uuid references class_groups (id);

-- 2) 發布權限班別化：
--    - 同工（admin）：可發布/修改全部（全體與各班）
--    - 各班老師：僅能發布/修改「自己被指派班別」的公告；
--      不可跨班、也不可發全體公告（class_group_id 必填）
drop policy if exists "announcements_write" on announcements;

create policy "announcements_admin_write" on announcements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "announcements_teacher_write" on announcements
  for all to authenticated
  using (class_group_id is not null and public.has_class_role(class_group_id))
  with check (class_group_id is not null and public.has_class_role(class_group_id));
