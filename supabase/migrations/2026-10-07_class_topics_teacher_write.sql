-- 需求增補 v20：預排主題開放給老師編輯
--
-- v16 #1 的定案是「同工編輯、老師查看」。組長改裁決：老師也能編輯——
-- 實務上主題常是帶班老師自己排的，要先找同工代填反而多一道手。
--
-- 權限範圍比照點名／教案：老師只能改**自己被指派班別**的主題（has_class_role），
-- 同工仍可改全部。讀取不變（全體同工與老師）。
-- 不動資料表結構，只換 policy；可重跑。

drop policy if exists "class_topics_write" on class_topics;
create policy "class_topics_write" on class_topics
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));
