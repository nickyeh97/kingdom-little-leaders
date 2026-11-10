-- =========================================================
-- 資料搬移（無結構變更）：12/5 園遊會，該週聚會改到 12/6（週日）
-- 對應前端 src/lib/config.ts 的 GATHERING_OVERRIDES['2026-12-05'] = '2026-12-06'
-- 前端上線後，已存在 12/5 的資料會「看不到」（行事曆 12/5 不再是聚會日），所以一併搬到 12/6。
-- 執行時機：v0.6.3 部署上線之後。可重複執行（第二次不會再有 12/5 的資料）。
-- 2026-11-10 檢查：attendance_plans 3 筆、class_topics 1 筆；其餘表皆 0 筆（全表一併處理，以防之後新增）。
-- ✅ 2026-11-10 已於正式庫執行：3 筆出席預填、1 筆預排主題搬到 12/6，updated_at/updated_by 保留原值。
-- 注意：attendance_plans 的 touch 觸發器會把 updated_by 設成 auth.uid()，直接跑 SQL 時為 null
--       → 違反 not null 而整批失敗；且搬日期不是家長修改，應保留原修改者/時間，故交易內暫停兩個 touch 觸發器。
-- =========================================================
begin;

alter table attendance_plans disable trigger on_attendance_plan_update;
alter table class_topics     disable trigger trg_touch_class_topic;

update attendance_plans        set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update check_ins               set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update class_topics            set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update lesson_segments         set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update service_weeks           set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update teacher_service_signups set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update child_service_signups   set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update child_service_rosters   set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update weekly_songs            set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';
update songs                   set gathering_date = '2026-12-06' where gathering_date = '2026-12-05';

alter table attendance_plans enable trigger on_attendance_plan_update;
alter table class_topics     enable trigger trg_touch_class_topic;

-- 驗證：應全為 0
select 'attendance_plans' t, count(*) from attendance_plans where gathering_date = '2026-12-05'
union all select 'class_topics', count(*) from class_topics where gathering_date = '2026-12-05';

commit;
