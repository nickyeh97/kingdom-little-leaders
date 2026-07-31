-- Sprint 04 Wave 1a：老師服事排班（T-COM-01/02/03、C-01）
-- 於 Supabase SQL Editor 執行。
--
-- 設計備忘：
-- - 服事項目字典 PRD 未定 → item 存文字＋前端提供建議選項，保留彈性
-- - 老師姓名以快照存欄（teacher_name），避免互查 profiles 的權限問題
-- - 彈性時間先以文字欄承接（v4 裁決 C：彈性時間教學是獨立藍標模組）

-- 每週各班服事內容（C-01a：日期、詩歌、主題課程、彈性時間；發布後老師可見）
create table if not exists service_weeks (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  songs_text text not null default '',   -- 詩歌（文字；曲庫連動後續）
  topic text not null default '',        -- 主題課程
  flex_text text not null default '',    -- 彈性時間安排
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gathering_date, class_group_id)
);
create index if not exists idx_service_weeks_date on service_weeks (gathering_date);

-- 老師服事報名（T-COM-01：依班別區分填寫權限；可填多個日期×項目）
create table if not exists teacher_service_signups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  teacher_name text not null default '',
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  item text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (teacher_id, gathering_date, class_group_id, item)
);
create index if not exists idx_signups_date on teacher_service_signups (gathering_date);

-- 排班結果（C-01b：同工依報名安排；teacher_name 快照供顯示/匯出）
create table if not exists service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_week_id uuid not null references service_weeks (id) on delete cascade,
  teacher_id uuid references profiles (id) on delete set null,
  teacher_name text not null default '',
  item text not null,
  sort_order int not null default 0
);
create index if not exists idx_assignments_week on service_assignments (service_week_id);

-- ---- RLS ----
alter table service_weeks enable row level security;
-- 老師看已發布；同工全看
create policy "service_weeks_read" on service_weeks
  for select to authenticated
  using (public.is_admin() or (public.is_staff() and published));
create policy "service_weeks_write" on service_weeks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table teacher_service_signups enable row level security;
-- 全體老師/同工可互看報名（T-COM-02 已報名總覽）
create policy "signups_read" on teacher_service_signups
  for select to authenticated using (public.is_staff());
-- 本人報名自己被指派的班別；同工可代填
create policy "signups_insert" on teacher_service_signups
  for insert to authenticated
  with check (
    public.is_admin()
    or (teacher_id = auth.uid() and public.has_class_role(class_group_id))
  );
create policy "signups_delete" on teacher_service_signups
  for delete to authenticated
  using (public.is_admin() or teacher_id = auth.uid());

alter table service_assignments enable row level security;
create policy "assignments_read" on service_assignments
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_staff() and exists (
      select 1 from service_weeks w
      where w.id = service_week_id and w.published
    ))
  );
create policy "assignments_write" on service_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
