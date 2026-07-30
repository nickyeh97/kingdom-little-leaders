-- Sprint 03 #3：專心/配合指數（規格書 v3 決議 2；Figma S2/S3）
-- 於 Supabase SQL Editor 執行。

-- 1) session_feedback 新增 engagement：1–4 級 emoji 量表
--    （4=😍 非常投入、3=🙂 投入、2=😐 普通、1=🥱 需要休息；
--     以「狀態」而非「成績」語彙呈現。null＝未評，幼幼班一律不評）
--    家長可見自己孩子的指數（沿用 session_feedback 既有 RLS，無需變更）
alter table session_feedback
  add column if not exists engagement smallint
  check (engagement between 1 and 4);

-- 2) 家長端「出席勾勾」（S3 幼幼班近三週走勢）：
--    只回傳自己綁定孩子的簽到「狀態」；check_ins 的 note（老師交接備註）
--    僅老師可見的決議不變——本函式刻意不 select note 欄位。
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
