-- =========================================================
-- 兒主平台 Phase 1 資料庫 Schema
-- 使用方式：Supabase Dashboard → SQL Editor 依序執行
--   1. schema.sql（本檔）
--   2. rls.sql
--   3. seed.sql（示範資料，正式環境可跳過）
-- =========================================================

create type user_role as enum ('admin', 'teacher', 'parent');
create type attendance_status as enum ('attending', 'leave', 'undecided');
create type checkin_status as enum ('present', 'leave'); -- 當日簽到/臨時請假

-- 班別（兒童/幼童/幼幼）
create table class_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

-- 使用者資料（對應 auth.users）
-- roles 為「角色標籤」集合：一人可同時為 admin + teacher + parent，
-- 擁有某標籤即開通該角色功能；admin 依規格書可使用全部功能
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  roles user_role[] not null default array['parent']::user_role[],
  approved boolean not null default false, -- 審核制：管理者核准後才開通角色功能
  auth_provider text not null default 'email', -- 預留：google / line / apple
  phone text,                                   -- 預留：通訊錄（Phase 2，最小化蒐集）
  created_at timestamptz not null default now()
);

-- 老師×班別 指派（老師標籤班別化：點名/日誌等依班別授權）
create table teacher_class_assignments (
  teacher_id uuid not null references profiles (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  primary key (teacher_id, class_group_id)
);

-- 孩子（不建帳號；由家長/老師代操作）
create table children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_group_id uuid not null references class_groups (id),
  service_eligible boolean not null default false, -- 服事資格（P-03；老師/同工可開關）
  level text,     -- 預留：大孩子階級（培訓中/正式領袖）
  birthday date,  -- 預留
  created_at timestamptz not null default now()
);

-- 家長-孩子綁定（一位家長可綁多孩、跨班別）
create table family_links (
  parent_id uuid not null references profiles (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  primary key (parent_id, child_id)
);

-- 預先出席（每孩每聚會日一筆；note = 家長給老師的話）
create table attendance_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  status attendance_status not null default 'undecided',
  note text,
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  unique (child_id, gathering_date)
);

-- 當日紀錄（每孩每聚會日一筆）：簽到/臨時請假＋課堂紀錄
-- note（課堂紀錄）為高敏感內容：僅老師可見、不對家長端顯示，
-- 定位是老師間的關懷交接，不是行為評語簿（守則紅燈 #7）
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  -- 點名所屬班別：跨班現場加入時＝加入的班（非孩子所屬班）
  class_group_id uuid not null references class_groups (id),
  gathering_date date not null,
  status checkin_status not null default 'present',
  note text,
  is_walk_in boolean not null default false,
  checked_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now(),
  unique (child_id, gathering_date)
);

-- 課堂表現回饋：老師以「表情」向家長說明課堂情況（取代成績）
-- 家長僅能看到自己孩子的回饋（RLS）；表情選項於前端維護（正向/關懷取向）
create table session_feedback (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  moods text[] not null default '{}',
  created_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  unique (child_id, gathering_date)
);

-- 專心度/配合度（v4 決議 2）：兩維 1–5（預設 5）；僅老師/同工可讀（家長不可見）；
-- 幼幼班不評；老師端可調閱近三個月走勢
create table performance_scores (
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  focus smallint check (focus between 1 and 5),
  cooperation smallint check (cooperation between 1 and 5),
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (child_id, gathering_date)
);
create index idx_perf_scores_date on performance_scores (gathering_date);

create or replace function public.touch_performance_scores()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger trg_touch_performance_scores before update on performance_scores
  for each row execute function public.touch_performance_scores();

-- 課堂紀錄（每班每聚會日一筆）：日期、老師、教學內容、詩歌進度、課後反饋
-- teacher_name 為填寫當下快照（供匯出顯示，避免老師互查 profiles 的權限問題）
create table session_logs (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id),
  gathering_date date not null,
  teacher_id uuid not null default auth.uid() references profiles (id),
  teacher_name text not null default '',
  content text not null default '',        -- 教學內容
  song_progress text not null default '',  -- 詩歌進度
  feedback text not null default '',       -- 課後反饋（給下一堂的老師）
  flow_score smallint check (flow_score is null or flow_score between 1 and 5),        -- 流程順暢度（v11 #5）
  cooperation_score smallint check (cooperation_score is null or cooperation_score between 1 and 5), -- 學生配合度（v11 #5）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_group_id, gathering_date)
);

create index idx_session_logs_date on session_logs (gathering_date);

create or replace function public.touch_session_log()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_session_log_update
  before update on session_logs
  for each row execute function public.touch_session_log();

-- 敬拜詩歌「曲庫」（v3 決議 5）：可一次上傳整學期、越新越上面；
-- 影音一律外連 YouTube（youtube_url＝詩歌、dance_url＝詩歌舞蹈）
create table songs (
  id uuid primary key default gen_random_uuid(),
  gathering_date date, -- 舊「每週歌單」時期欄位；曲庫化後由 song_schedule 排程
  title text not null,
  youtube_url text,
  dance_url text,
  lyrics text,
  sort_order int not null default 0,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_songs_date on songs (gathering_date);

-- 歌單期間（班別 × 期間，如「2026年7-8月」雙月歌單；v4 決議 4：以班別區分。
-- 幼幼班無詩歌模組（只有點名＋課後紀錄）。欄位依現行共編 Excel「（兒童班）敬拜歌單」）
create table song_playlists (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  title text not null,             -- 例：2026年7-8月
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (class_group_id, title)
);

create table playlist_songs (
  playlist_id uuid not null references song_playlists (id) on delete cascade,
  song_id uuid not null references songs (id) on delete cascade,
  sort_order int not null default 0,
  primary key (playlist_id, song_id)
);

-- 本週歌單（v11 #1）：把歌曲排到具體聚會日，教案頁取該日、詩歌頁取下次聚會日。
-- 取代 playlist_songs.is_weekly（該欄保留但不再使用）。
create table weekly_songs (
  class_group_id uuid not null references class_groups (id) on delete cascade,
  gathering_date date not null,
  song_id uuid not null references songs (id) on delete cascade,
  sort_order int not null default 0,
  primary key (class_group_id, gathering_date, song_id)
);
create index idx_weekly_songs_date on weekly_songs (gathering_date, class_group_id);

-- 兩維熟悉度（班別 × 歌曲；歌唱/動作各 1–5：1＝不熟、5＝熟悉——v4 決議 3）
-- 記錄於詩歌曲目上；老師可於詩歌頁直接編輯或於日誌流程覆寫；幼幼班不需填寫。
-- 欄位依 Excel「敬拜過的歌單」：熟悉指數、填寫人（快照）、填寫日期、上課日期
create table song_familiarity (
  song_id uuid not null references songs (id) on delete cascade,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  song_level smallint check (song_level between 1 and 5),
  motion_level smallint check (motion_level between 1 and 5),
  last_practiced_on date,
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_by_name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (song_id, class_group_id)
);

create or replace function public.touch_song_familiarity()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger trg_touch_song_familiarity before update on song_familiarity
  for each row execute function public.touch_song_familiarity();

-- 公告（所有登入者可讀）；class_group_id：null＝全體公告，其餘為班別公告（v3 決議 4）
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tag text not null default '行政' check (tag in ('行政', '課程')), -- 分類（v0.3.2；醒目度由 pinned 承擔）
  class_group_id uuid references class_groups (id),
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()  -- 最後編輯時間（v11 #8）
);

-- 編輯公告時自動更新 updated_at（created_at 維持「發布日」不動）
create or replace function public.touch_announcement()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger trg_touch_announcement before update on announcements
  for each row execute function public.touch_announcement();

create index idx_plans_gathering on attendance_plans (gathering_date);
create index idx_checkins_gathering on check_ins (gathering_date);
create index idx_children_class on children (class_group_id);

-- 預先出席更新時自動刷新 updated_at / updated_by（upsert 的 update 分支不會套用 default）
create or replace function public.touch_attendance_plan()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger on_attendance_plan_update
  before update on attendance_plans
  for each row execute function public.touch_attendance_plan();

-- 新使用者註冊時自動建立 profile（預設角色：家長）
-- display_name 優先序：註冊表單 display_name → Google 的 full_name/name → email 前綴
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, auth_provider)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Sprint 04 Wave 1a：老師服事排班 =====

-- 每週各班服事內容（C-01a：日期、詩歌、主題課程、彈性時間文字欄；發布後老師可見）
create table service_weeks (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  songs_text text not null default '',
  topic text not null default '',
  flex_text text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gathering_date, class_group_id)
);
create index idx_service_weeks_date on service_weeks (gathering_date);

-- 老師服事報名（T-COM-01：依班別區分填寫權限；teacher_name 快照）
create table teacher_service_signups (
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
create index idx_signups_date on teacher_service_signups (gathering_date);

-- 排班結果（C-01b；teacher_name 快照供顯示/匯出）
create table service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_week_id uuid not null references service_weeks (id) on delete cascade,
  teacher_id uuid references profiles (id) on delete set null,
  teacher_name text not null default '',
  item text not null,
  sort_order int not null default 0
);
create index idx_assignments_week on service_assignments (service_week_id);

-- ===== Sprint 04 Wave 1b：兒童服事 =====

-- 兒童服事報名（P-04：家長為符合資格的孩子勾選日期×項目）
create table child_service_signups (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  gathering_date date not null,
  item text not null,
  note text,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now(),
  unique (child_id, gathering_date, item)
);
create index idx_child_signups_date on child_service_signups (gathering_date);

-- 兒童服事項目字典（v11 #4）：名稱＋說明由同工維護，授權與報名的勾選按鈕同步讀這張表
create table child_service_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,            -- 也是 child_service_* 各表 item 欄位的值
  description text not null default '',
  sort_order int not null default 0,
  active boolean not null default true, -- 停用＝不再出現在新的勾選，既有紀錄不動
  created_at timestamptz not null default now()
);

-- 兒童服事表（C-02：同工依報名排班；發布後家長/老師可見）
create table child_service_rosters (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gathering_date, class_group_id)
);
create index idx_child_rosters_date on child_service_rosters (gathering_date);

create table child_service_assignments (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references child_service_rosters (id) on delete cascade,
  child_id uuid references children (id) on delete set null,
  child_name text not null default '',
  item text not null,
  sort_order int not null default 0
);
create index idx_child_assignments_roster on child_service_assignments (roster_id);

-- ===== Sprint 04 Wave 2：教學模組 =====

-- 教案（每班每聚會日；列＝流程段落，欄位依現行共編 Excel；分區塊共編）
create table lesson_segments (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  gathering_date date not null,
  time_text text not null default '',
  item text not null default '',
  content text not null default '',
  teacher_text text not null default '',
  materials_text text not null default '',
  review_text text not null default '',
  sort_order int not null default 0,
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_by_name text not null default '',
  updated_at timestamptz not null default now()
);
create index idx_lesson_segments_date on lesson_segments (gathering_date, class_group_id);

create or replace function public.touch_lesson_segment()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger trg_touch_lesson_segment before update on lesson_segments
  for each row execute function public.touch_lesson_segment();

-- 聚會流程（flow：主題/內容/方式）與運作要點（guide）；每班一份、資訊頁
create table class_docs (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references class_groups (id) on delete cascade,
  kind text not null check (kind in ('flow', 'guide')),
  title text not null,
  content text not null default '',
  extra text not null default '',
  minutes int,                          -- 建議時間（分鐘；v9 #3，教案範本依此帶入）
  sort_order int not null default 0
);
create index idx_class_docs on class_docs (class_group_id, kind);

-- 教材資料庫（外連型；class_group_id null＝共用）
create table materials (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid references class_groups (id) on delete cascade,
  category text not null default '未分類',
  title text not null,
  url text not null,
  note text not null default '',
  created_by uuid not null default auth.uid() references profiles (id),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index idx_materials_class on materials (class_group_id, category);

-- ===== Sprint 04 Wave 3：會議與行政 =====

-- 會議（scope：all＝全體大會、staff＝核心同工、class＝班別）
create table meetings (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('all', 'staff', 'class')),
  class_group_id uuid references class_groups (id) on delete cascade,
  meeting_date date not null,
  title text not null,
  minutes text not null default '',
  created_by uuid not null default auth.uid() references profiles (id),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index idx_meetings_date on meetings (meeting_date desc);

-- 事項追蹤（決議事項／分工／預計完成日期／狀態 待辦-進行中-已完成）
create table meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  content text not null,
  assignee text not null default '',
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  sort_order int not null default 0
);
create index idx_meeting_items on meeting_items (meeting_id);

-- 會議附件連結（v11 #11）：講義/簡報/錄影放教會 NAS 或 Google 雲端，平台只存外連
create table meeting_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  title text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_meeting_links on meeting_links (meeting_id, sort_order);

-- 組織架構／分工（C-06）
create table org_units (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  members_text text not null default '',
  note text not null default '',
  sort_order int not null default 0
);
