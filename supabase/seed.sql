-- =========================================================
-- 示範資料（僅供開發測試；一律使用假名，不得放入真實兒童個資）
-- 正式環境：只執行班別區塊，孩子與綁定由管理者於後台建立
-- =========================================================

insert into class_groups (name, sort_order) values
  ('兒童班', 1),
  ('幼童班', 2),
  ('幼幼班', 3);

-- 示範孩子（假名）
insert into children (name, class_group_id)
select x.name, cg.id
from (values
  ('王小明', '兒童班'),
  ('李小華', '兒童班'),
  ('陳小美', '幼童班'),
  ('張小安', '幼幼班')
) as x (name, class_name)
join class_groups cg on cg.name = x.class_name;

-- 示範公告
-- 注意：created_by 預設 auth.uid()，在 SQL Editor 執行時沒有登入者，
-- 請先在 Authentication 建立自己的帳號並設為 admin，再以該 id 代入：
-- insert into announcements (title, body, tag, pinned, created_by) values
--   ('歡迎使用兒主平台', '這是第一則公告，之後每週公告都會在這裡發布。', '公告', true, '<你的 user id>');
