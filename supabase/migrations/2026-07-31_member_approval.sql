-- =========================================================
-- Migration：會員審核機制＋刪除會員
-- 1) profiles.approved：新註冊預設未審核；未審核者僅能看公告與帳號設定
--    （my_roles() 對未審核者回空陣列 → 所有角色權限在資料庫層自動失效）
-- 2) 管理者可核准、可刪除成員（不可刪自己）
-- 3) 防自我審核：非管理者不得修改自己的 approved
-- 適用：已執行 2026-07-30_google_auth.sql 的資料庫
-- =========================================================

-- 1. 審核欄位；既有成員（開放註冊前建立的）視為已審核
alter table profiles add column approved boolean not null default false;
update profiles set approved = true;

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select approved from profiles where id = auth.uid()), false)
$$;

-- 未審核者視同無任何角色標籤（has_role/is_admin/is_staff 全部隨之失效）
create or replace function public.my_roles()
returns user_role[]
language sql stable security definer set search_path = public
as $$
  select case when approved then roles else '{}'::user_role[] end
  from profiles where id = auth.uid()
$$;

-- 未審核者亦無家長-孩子綁定視角
create or replace function public.my_child_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select child_id from family_links
  where parent_id = auth.uid() and public.is_approved()
$$;

-- 2. 詩歌改為僅已審核者可讀（未審核僅剩公告）
drop policy "songs_read" on songs;
create policy "songs_read" on songs
  for select to authenticated using (public.is_approved());

-- 3. 防自我審核：update policy 的 with check 加入 approved 不可自改
drop policy "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and roles = (select p.roles from profiles p where p.id = auth.uid())
      and approved = (select p.approved from profiles p where p.id = auth.uid())
    )
  );

-- 4. 刪除成員：僅管理者、且不得刪除自己
--    （會一併移除其家庭綁定；Auth 帳號本身需於後台或未來 Edge Function 清除）
create policy "profiles_delete_admin" on profiles
  for delete to authenticated
  using (public.is_admin() and id <> auth.uid());
