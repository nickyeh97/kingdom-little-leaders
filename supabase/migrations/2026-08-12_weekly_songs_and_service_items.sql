-- Sprint 06：本週歌曲（#1）＋兒童服事舊項目清理（#6a）
-- 於 Supabase SQL Editor 執行；整支可重複執行（冪等）。

-- 1) 本週歌曲：歌單內可勾選多首，詩歌頁置頂顯示；RLS 沿用既有政策不變。
alter table playlist_songs
  add column if not exists is_weekly boolean not null default false;

-- 2) 兒童服事項目定案為固定六項（2026-08-27 指示）：
--    清除「非六項」的舊資料（授權/報名/排班），畫面只剩新項目。
--    注意：此為不可復原的刪除；授權刪除後 children.service_eligible
--    會由觸發器自動同步（僅剩舊項目的孩子將變回無資格，需重新逐項開通）。
delete from child_service_signups
where item not in ('收奉獻', '敬拜-司琴', '敬拜-小樂器', '敬拜-Vocal', '領讀天使-宣言/讀經/禱告', '環境稽核');

delete from child_service_assignments
where item not in ('收奉獻', '敬拜-司琴', '敬拜-小樂器', '敬拜-Vocal', '領讀天使-宣言/讀經/禱告', '環境稽核');

delete from child_service_permissions
where item not in ('收奉獻', '敬拜-司琴', '敬拜-小樂器', '敬拜-Vocal', '領讀天使-宣言/讀經/禱告', '環境稽核');

notify pgrst, 'reload schema';
