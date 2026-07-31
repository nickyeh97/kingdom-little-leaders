-- 現場加入修正（v4 決議 5 落地補強）：
-- check_ins 新增「點名所屬班別」class_group_id——
-- 1. 跨班現場加入的孩子，重新載入後仍顯示在「加入的那個班」的點名頁（不再消失）
-- 2. 寫入權限改依「點名所屬班別」：本班老師可將全校名冊上的任何孩子加入本班當日
--    （原 child_in_my_class 依孩子所屬班別判斷，會擋掉跨班現場加入）
-- 於 Supabase SQL Editor 執行。

alter table check_ins
  add column if not exists class_group_id uuid references class_groups (id);

-- 回填既有紀錄：以孩子所屬班別為準
update check_ins c
set class_group_id = ch.class_group_id
from children ch
where ch.id = c.child_id and c.class_group_id is null;

alter table check_ins alter column class_group_id set not null;

drop policy if exists "check_ins_insert" on check_ins;
drop policy if exists "check_ins_update" on check_ins;
drop policy if exists "check_ins_delete" on check_ins;

create policy "check_ins_insert" on check_ins
  for insert to authenticated with check (public.has_class_role(class_group_id));
create policy "check_ins_update" on check_ins
  for update to authenticated
  using (public.has_class_role(class_group_id))
  with check (public.has_class_role(class_group_id));
create policy "check_ins_delete" on check_ins
  for delete to authenticated using (public.has_class_role(class_group_id));

notify pgrst, 'reload schema';
