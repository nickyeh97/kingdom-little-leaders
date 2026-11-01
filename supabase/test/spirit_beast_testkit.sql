-- =========================================================
-- 小領袖靈獸：快轉測試工具（只能在測試資料庫執行）
-- =========================================================
-- 用途：把測試孩子的服事次數直接設成 N，再到遊戲按一次「＋1 服事」，就能看到那一次的進化，
--       不必真的按 24 次。也可以 N = 0 並清掉靈獸，從「第一次相遇」重來。
--
--   要看的畫面                 N（設好後再到遊戲按一次 ＋1）
--   第一次相遇                 0，並把 reset_beast 設成 true（不必按 ＋1，直接開遊戲）
--   初生 → 成長（第 4 次）      3
--   成長 → 茁壯（第 12 次）     11
--   茁壯 → 小領袖（第 24 次）   23
--
-- 用法：SQL Editor 貼上整份 → 改下面三個值 → Run。可以重複執行（每次都會先清掉這位測試孩子的紀錄）。
-- 測試孩子一律用假名；家長帳號要先在測試平台註冊好（用 Email 註冊即可）。

do $$
declare
  test_parent_email text := 'test-parent@example.com';  -- ← 測試家長帳號的 Email
  target_count      int  := 23;                          -- ← 要先有幾次服事（N）
  reset_beast       bool := false;                       -- ← true：清掉靈獸，從第一次相遇重來
  test_child_name   text := '測試小明';                   -- 假名；會自動建在兒童班
  parent uuid;
  child uuid;
  class_id uuid;
  items text[];
begin
  -- 防呆一：沒有測試標記就不執行（標記只在測試專案用 mark_as_test_database.sql 建立）
  if to_regclass('public.zz_test_database') is null then
    raise exception '這不是測試資料庫（找不到 zz_test_database 標記），已停止。正式資料庫請勿執行測試工具。';
  end if;
  -- 防呆二：正式資料庫有 40 幾位孩子；測試資料庫應該只有少數假名
  if (select count(*) from children) > 20 then
    raise exception '孩子超過 20 位，看起來像正式資料庫，已停止。';
  end if;

  select u.id into parent from auth.users u where lower(u.email) = lower(test_parent_email);
  if parent is null then
    raise exception '找不到 % 這個帳號：請先在測試平台用這個 Email 註冊', test_parent_email;
  end if;
  -- 測試家長：審核通過、有家長標籤
  update profiles set approved = true,
         roles = (select array(select distinct unnest(roles || array['parent']::user_role[])))
   where id = parent;

  -- 兒童班與服事項目（全新測試專案可能還沒有）
  insert into class_groups (name, sort_order)
  select '兒童班', 1 where not exists (select 1 from class_groups where name = '兒童班');
  select id into class_id from class_groups where name = '兒童班' limit 1;
  insert into child_service_items (name, sort_order) values
    ('奉獻服事長', 1), ('場地檢核服事長', 2), ('領讀服事長', 3), ('小秘書服事長', 4),
    ('敬拜-小樂器', 5), ('敬拜-司琴', 6), ('敬拜-Vocal', 7)
  on conflict (name) do nothing;

  -- 測試孩子＋綁定家長
  select id into child from children where name = test_child_name limit 1;
  if child is null then
    insert into children (name, class_group_id) values (test_child_name, class_id) returning id into child;
  end if;
  insert into family_links (parent_id, child_id) values (parent, child) on conflict do nothing;

  -- 服事次數設成 N：先清掉，再補 N 筆（項目輪流、每筆往前隔 7 天，看起來像每週服事）
  delete from service_card_entries where child_id = child;
  select array_agg(name order by sort_order) into items from child_service_items where active;
  insert into service_card_entries (child_id, item, recorded_by, created_at)
  select child, items[1 + (i % array_length(items, 1))], parent, now() - make_interval(days => 7 * (target_count - i))
  from generate_series(0, target_count - 1) as i;

  if reset_beast then
    delete from beast_profiles where child_id = child;
  end if;

  raise notice '完成：% 現在有 % 次服事%。到測試平台「我的 → 小領袖靈獸」開遊戲。',
    test_child_name, target_count, case when reset_beast then '，靈獸已清掉（會從第一次相遇開始）' else '' end;
end $$;
