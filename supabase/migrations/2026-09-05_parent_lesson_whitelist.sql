-- 需求增補 v14 #6：家長版教案只顯示指定項目
--
-- 組長定案：家長只需要看「敬拜」「信息／主題（任一符合）」「背金句」「彈性時間」。
--
-- 兩個改動：
--
-- 1. **白名單下放到 RPC**。原本 RPC 把整份教案（含「環境整理」「服事分工」「結束禱告」
--    這類純流程列）全部送到家長的瀏覽器，只在前端用 isCourseSegment() 過濾。
--    家長開開發者工具就看得到完整流程表。依 CLAUDE.md「所有權限規則優先寫成 RLS policy；
--    前端的角色判斷只是 UX，不是安全邊界」，過濾必須在資料庫這一層。
--
-- 2. **維持「有內容才顯示」**。項目沒填內容幾乎等於老師忘了寫，
--    顯示一列空白的「背金句」對家長沒有意義。教案頁會對白名單項目標示
--    「這項會顯示給家長」提醒老師填寫（見 LessonPlanView.vue）。
--
-- 要新增顯示給家長的項目：改下面 array 這一行即可（前端 src/lib/parentLesson.ts
-- 的 PARENT_VISIBLE_ITEMS 要一起改，兩邊有測試互相對照）。
-- 用 like '%關鍵字%' 而不是完全相等，是因為 item 是自由文字，
-- 正式資料同時存在「信息」「信息 但以理在獅子坑」「信息／主題」三種寫法。

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
    and btrim(s.content) <> ''                           -- 沒填內容＝老師還沒寫，不顯示空白列
    and exists (
      select 1
      from unnest(array['敬拜', '信息', '主題', '背金句', '彈性時間']) as w
      where s.item like '%' || w || '%'
    )
  order by s.gathering_date desc, s.sort_order
$$;
grant execute on function public.parent_lesson_segments(date, date) to authenticated;
