-- v10 #1/#2：家長端可看「組織架構＋孩子班別的老師名單」與「孩子上過的課程（簡易版教案）」
--
-- 個資紅線（CLAUDE.md）：本檔新增的兩個函式**只回傳稱呼（display_name）**，
-- 不回傳 email、phone 或任何聯絡方式；profiles 的 RLS（本人或 admin 可讀）維持不動。
-- 教案的「教材預備」「課後執行」屬同工內部欄位，函式刻意不 select（比照 parent_checkin_marks 不回傳 note）。

-- 我綁定的孩子所屬班別（家長端授權範圍的單一來源）
create or replace function public.my_child_class_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct c.class_group_id
  from children c
  where c.id in (select public.my_child_ids())
$$;

-- 班別老師名單：同工看全部班別，家長只看自己孩子的班別。
-- 僅回傳稱呼，供「組織架構與分工」頁顯示「＊＊班的老師」。
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

-- 家長版簡易教案：只回「已經上過的課」，且只有孩子所屬班別。
-- 幼幼班無教案模組（v4 決議 8：幼幼班只有點名＋老師課後紀錄），依班名排除。
-- 欄位只給「項目 / 內容 / 帶班老師」——時間、教材預備、課後執行不外流。
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
