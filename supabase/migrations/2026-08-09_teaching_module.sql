-- Sprint 04 Wave 2：教學模組（T-KID-04/06/07/08、T-TOD-03/05/06/07、C-04）
-- 於 Supabase SQL Editor 執行。
--
-- 設計備忘：
-- - 教案欄位依現行共編 Excel：時間｜項目｜內容｜老師｜教材預備/備註｜課後執行記錄
-- - 分區塊共編（v4 裁決 B）：以「列」為單位各自儲存，主題課程/彈性時間
--   各自的老師編各自的列；非游標級即時共編
-- - 教材庫為外連型（v4 裁決 A）：檔案放教會 NAS/雲端，平台存連結＋目錄
-- - 教案/流程/要點/教材庫皆不含幼幼班（權限矩陣：幼幼班「無」）——前端過濾

-- 1) 教案（每班每聚會日一份；列＝流程段落，各列獨立編輯）
create table if not exists lesson_segments (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  gathering_date date not null,
  time_text text not null default '',      -- 時間（分鐘數＋時段，如 5分鐘 1400-1405）
  item text not null default '',           -- 項目（破冰/敬拜/信息/彈性…）
  content text not null default '',        -- 內容（可含連結）
  teacher_text text not null default '',   -- 老師（該段落負責人，自由填）
  materials_text text not null default '', -- 教材預備/備註
  review_text text not null default '',    -- 課後執行記錄（改善&建議）
  sort_order int not null default 0,
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_by_name text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists idx_lesson_segments_date
  on lesson_segments (gathering_date, class_group_id);

create or replace function public.touch_lesson_segment()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists trg_touch_lesson_segment on lesson_segments;
create trigger trg_touch_lesson_segment before update on lesson_segments
  for each row execute function public.touch_lesson_segment();

-- 2) 聚會流程與運作要點（每班各一份；資訊頁，列式內容）
--    兒童班流程欄位：主題｜內容｜方式（固定/彈性）；運作要點：主題｜內容
create table if not exists class_docs (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  kind text not null check (kind in ('flow', 'guide')), -- flow=聚會流程、guide=運作要點
  title text not null,          -- 主題
  content text not null default '',
  extra text not null default '', -- 流程：方式（固定/彈性）；要點：備註
  sort_order int not null default 0
);
create index if not exists idx_class_docs on class_docs (class_group_id, kind);

-- 3) 教材資料庫（外連型：目錄＋連結；class_group_id null＝共用教材）
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid references class_groups (id) on delete cascade, -- null＝共用
  category text not null default '未分類', -- 目錄（影片/PPT/講義/學習單…）
  title text not null,
  url text not null,               -- 教會 NAS/雲端/YouTube 連結
  note text not null default '',
  created_by uuid not null default auth.uid() references profiles (id),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_materials_class on materials (class_group_id, category);

-- ---- RLS ----
alter table lesson_segments enable row level security;
-- 教案：老師/同工可讀（家長無——權限矩陣）
create policy "lesson_segments_read" on lesson_segments
  for select to authenticated using (public.is_staff());
-- 該班老師與同工可寫（分區塊共編）
create policy "lesson_segments_write" on lesson_segments
  for all to authenticated
  using (public.is_admin() or public.has_class_role(class_group_id))
  with check (public.is_admin() or public.has_class_role(class_group_id));

alter table class_docs enable row level security;
create policy "class_docs_read" on class_docs
  for select to authenticated using (public.is_staff());
create policy "class_docs_write" on class_docs
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table materials enable row level security;
create policy "materials_read" on materials
  for select to authenticated using (public.is_staff());
-- 老師可自由上傳共用（PRD 進階功能）；刪除限本人或同工
create policy "materials_insert" on materials
  for insert to authenticated with check (public.is_staff());
create policy "materials_update" on materials
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy "materials_delete" on materials
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

notify pgrst, 'reload schema';
