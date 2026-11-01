-- =========================================================
-- 標記「這是測試資料庫」——只在測試用的 Supabase 專案執行一次，正式專案絕對不要執行
-- =========================================================
-- supabase/test/ 底下的測試工具開頭會檢查這張表，沒有就拒絕執行，
-- 避免把假資料、刪除紀錄的指令誤跑到正式資料庫。
create table if not exists zz_test_database (
  marked_at timestamptz not null default now()
);
insert into zz_test_database default values;
