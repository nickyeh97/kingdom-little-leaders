-- v9 #3：聚會流程項目的「建議時間」改為獨立欄位
-- 原本時間塞在 extra 文字裡（如「必做・約5分鐘」），無法可靠讀取；
-- 教案範本（v9 #4）要依聚會流程帶入時長，必須有結構化欄位。
alter table class_docs add column if not exists minutes int;

-- 舊資料回填：從 extra 抓第一個「N分」的數字（抓不到就留 null）
update class_docs
set minutes = (substring(extra from '(\d+)\s*分'))::int
where minutes is null
  and extra ~ '\d+\s*分';

notify pgrst, 'reload schema';
