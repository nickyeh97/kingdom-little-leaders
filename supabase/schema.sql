-- =========================================================
-- 兒主平台 Phase 1 資料庫 Schema
-- 使用方式：Supabase Dashboard → SQL Editor 依序執行
--   1. schema.sql（本檔）
--   2. rls.sql
--   3. seed.sql（示範資料，正式環境可跳過）
-- =========================================================

create type user_role as enum ('admin', 'teacher', 'parent');
create type attendance_status as enum ('attending', 'leave', 'undecided');

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
  auth_provider text not null default 'email', -- 預留：google / line / apple
  phone text,                                   -- 預留：通訊錄（Phase 2，最小化蒐集）
  created_at timestamptz not null default now()
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

-- 預先出席（每孩每主日一筆）
create table attendance_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  sunday_date date not null,
  status attendance_status not null default 'undecided',
  updated_by uuid not null default auth.uid() references profiles (id),
  updated_at timestamptz not null default now(),
  unique (child_id, sunday_date)
);

-- 現場簽到（每孩每主日一筆；is_walk_in = 未預先報名的現場加入）
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  sunday_date date not null,
  is_walk_in boolean not null default false,
  checked_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now(),
  unique (child_id, sunday_date)
);

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

create index idx_plans_sunday on attendance_plans (sunday_date);
create index idx_checkins_sunday on check_ins (sunday_date);
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

-- 新使用者註冊時自動建立 profile
-- display_name 取自邀請時的 user_metadata，否則以 email 前綴代替
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, auth_provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
