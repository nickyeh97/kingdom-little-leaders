-- =========================================================
-- Migration：sunday_date 更名為 gathering_date
-- 緣由：本教會主日聚會於「週六下午」舉行，且聚會日不強制固定週幾，
--       欄位命名不得假設週日（Sunday）
-- 適用：已執行 2026-07-27_checkin_notes_and_tag_auth.sql 的資料庫
-- =========================================================

alter table attendance_plans rename column sunday_date to gathering_date;
alter table check_ins rename column sunday_date to gathering_date;
alter table session_feedback rename column sunday_date to gathering_date;

alter index idx_plans_sunday rename to idx_plans_gathering;
alter index idx_checkins_sunday rename to idx_checkins_gathering;
