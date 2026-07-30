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

-- 敬拜歌單：每聚會日一組（約 4 首）；影音一律外連 YouTube
create table songs (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  title text not null,
  youtube_url text,
  lyrics text,
  sort_order int not null default 0,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_songs_date on songs (gathering_date);

-- 公告（所有登入者可讀）
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tag text not null default '公告',
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now()
);

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
