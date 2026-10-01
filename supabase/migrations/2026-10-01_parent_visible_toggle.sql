-- 需求增補 v19：家長看不看得到，由寫教案的老師自己決定
--
-- v14 #6 的做法是「項目名稱符合白名單（敬拜／信息／主題／背金句／彈性時間）就給家長看」，
-- 清單寫死在 RPC 裡。組長要的是：每個段落後面一顆開關，老師自行決定要不要秀。
--
-- 做法：
--   1. lesson_segments 加 parent_visible 欄位（預設 false）
--   2. 回填既有資料：符合舊白名單的段落設 true——上線後家長看到的內容一筆都不會變
--   3. RPC 改看這個欄位，不再比對名稱。「有填內容才顯示」維持不變（組長定案：
--      開關打開但內容沒填，家長端還是不顯示，教案頁會提醒老師填）
--
-- 真正的邊界仍在這支 RPC（家長端只走它）；前端的開關只是老師的操作介面。
-- 舊白名單降級為「新段落的預設值」，留在 src/lib/parentLesson.ts。

alter table lesson_segments
  add column if not exists parent_visible boolean not null default false;

comment on column lesson_segments.parent_visible is
  '老師決定這一段要不要顯示在家長的「孩子上過的課程」（v19）。'
  '內容為空時即使 true 也不顯示（見 parent_lesson_segments）。';

-- 回填：符合 v14 #6 白名單的既有段落視為「老師已決定要給家長看」。
-- 只在欄位剛加上、全部還是 false 時有意義；重跑不會把老師後來關掉的再打開
-- （條件限定 updated_at 早於這支 migration 執行的當下不可靠，改用「尚未有人碰過」的近似：
--  只更新目前仍為 false 且符合白名單者。老師關掉後若再重跑會被打開——
--  這支只該執行一次，重跑前請先確認）。
update lesson_segments s
set parent_visible = true
where not s.parent_visible
  and exists (
    select 1
    from unnest(array['敬拜', '信息', '主題', '背金句', '彈性時間']) as w
    where s.item like '%' || w || '%'
  );

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
    and s.parent_visible                                 -- 老師開了「顯示給家長」（v19）
    and btrim(s.content) <> ''                           -- 沒填內容＝老師還沒寫，不顯示空白列
  order by s.gathering_date desc, s.sort_order
$$;
grant execute on function public.parent_lesson_segments(date, date) to authenticated;
