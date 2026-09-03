-- v11 #8：公告加上「最後編輯時間」
--
-- 問題（2026-09-03 師母回報）：一則 7/28 建立的公告被編輯後，畫面日期仍是 7/28。
-- 查證：announcements 只有 created_at（建立時間），**沒有** updated_at，
-- 編輯自然不會改到日期——顯示的是「發布日」，不是「最後更新日」，並非資料寫錯。
-- 這裡補上 updated_at 與觸發器，畫面才有辦法標示「已編輯」。
--
-- 於 Supabase SQL Editor 執行；可重複執行（冪等）。

alter table announcements
  add column if not exists updated_at timestamptz not null default now();

-- 既有資料沒有編輯歷史：一律對齊 created_at，
-- 否則加欄位當下的 now() 會讓所有舊公告都顯示成「今天編輯過」。
update announcements set updated_at = created_at where updated_at <> created_at;

create or replace function public.touch_announcement()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_announcement on announcements;
create trigger trg_touch_announcement
  before update on announcements
  for each row execute function public.touch_announcement();

notify pgrst, 'reload schema';
