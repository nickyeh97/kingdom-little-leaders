-- v0.3.2：公告標籤從「重要度」改為「分類」——行政公告／課程公告
--
-- 背景：原本 tag 是「公告／重要」（重要度）。組長要的是**給家長辨識性質**的分類，
-- 而卡片上已經有「班別」標籤，再加第三個會把標題擠到換行（390px＋1.4 倍字級）。
-- 因此直接沿用 tag 欄位改變其語意，而不是新增欄位。
-- 「醒目度」由既有的 pinned（📌 置頂）承擔。
--
-- 於 Supabase SQL Editor 執行；可重複執行（冪等）。

-- 1) 既有資料對應：舊的「重要」實際上都是課堂提醒（金句、帶鉛筆盒），對到「課程」；
--    其餘（平台手冊、家長說明會）對到「行政」。
--    這是可解釋的規則而不是逐筆寫死，其他環境也適用；
--    同工可於公告編輯內自行調整分類。
update announcements set tag = '課程' where tag = '重要';
update announcements set tag = '行政' where tag not in ('行政', '課程');

-- 2) 只允許兩種分類，避免日後又冒出自由文字
alter table announcements alter column tag set default '行政';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'announcements_tag_check') then
    alter table announcements drop constraint announcements_tag_check;
  end if;
  alter table announcements
    add constraint announcements_tag_check check (tag in ('行政', '課程'));
end $$;

notify pgrst, 'reload schema';
