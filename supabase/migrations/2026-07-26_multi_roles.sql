-- =========================================================
-- Migration：單一角色 → 多角色標籤（roles user_role[]）
-- 適用：已依 2026-07-26 版 schema.sql + rls.sql 初始化的資料庫
-- 於 SQL Editor 一次執行整份即可；既有資料的角色會自動搬移
-- =========================================================

-- 1. 先移除引用 role 欄位的 policy（稍後重建）
drop policy "profiles_update_self" on profiles;

-- 2. 欄位改造：role -> roles（把現有單一角色搬進陣列）
alter table profiles add column roles user_role[] not null default array['parent']::user_role[];
update profiles set roles = array[role];
alter table profiles drop column role;

-- 3. 函式改為多角色版本
drop function if exists public.my_role();

create or replace function public.my_roles()
returns user_role[]
language sql stable security definer set search_path = public
as $$
  select roles from profiles where id = auth.uid()
$$;

create or replace function public.has_role(r user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select r = any (coalesce(public.my_roles(), '{}'))
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin')
$$;

create or replace function public.is_staff() -- 具老師或管理者標籤
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin') or public.has_role('teacher')
$$;

-- 4. 重建 profiles 更新 policy（非管理者不得改自己的 roles，防自我提權）
create policy "profiles_update_self" on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and roles = (select p.roles from profiles p where p.id = auth.uid())
    )
  );
