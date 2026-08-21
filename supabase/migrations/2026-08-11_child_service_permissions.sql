-- Sprint 05 Wave 3：兒童服事資格細化到項目（v5 反饋 #3）
-- 於 Supabase SQL Editor 執行。
--
-- 設計備忘：
-- - 資格由「一個開關」改為「孩子 × 項目」逐項授權；家長端報名只顯示已授權項目
-- - 組長裁決（2026-08-20）：項目字典沿用五項建議＋可自訂新增（item 為文字）
-- - children.service_eligible 改為派生欄位（有任一項授權＝true，觸發器維護），
--   既有讀取處（名單/排班「具資格孩子」清單）不需改動
-- - 授權開關的權限沿用 P-03：該班老師或同工

-- 1) 孩子×項目授權表
create table if not exists child_service_permissions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  item text not null,
  created_by_name text not null default '',  -- 快照：誰開通的（顯示用）
  created_at timestamptz not null default now(),
  unique (child_id, item)
);
create index if not exists idx_child_permissions_child
  on child_service_permissions (child_id);

-- 2) 回填：既有具資格的孩子帶入五項建議項目（維持原本可報名的範圍）
insert into child_service_permissions (child_id, item)
select c.id, i.item
from children c
cross join (values ('收奉獻'), ('招待'), ('敬拜小幫手'), ('禱告'), ('清潔/整理')) as i(item)
where c.service_eligible
on conflict (child_id, item) do nothing;

-- 3) service_eligible 改為派生：授權表異動時自動同步
--    （security definer：老師寫授權表時，同步 children 不受其 RLS 限制）
create or replace function public.sync_child_service_eligible()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
begin
  cid := coalesce(new.child_id, old.child_id);
  update children
  set service_eligible = exists (
    select 1 from child_service_permissions p where p.child_id = cid
  )
  where id = cid;
  return null;
end;
$$;
drop trigger if exists trg_sync_child_eligible on child_service_permissions;
create trigger trg_sync_child_eligible
  after insert or delete on child_service_permissions
  for each row execute function public.sync_child_service_eligible();

-- 4) 舊的整體開關 RPC 移除（避免與逐項授權脫鉤；前端已改走授權表）
drop function if exists public.set_child_service_eligible(uuid, boolean);

-- ---- RLS ----
alter table child_service_permissions enable row level security;
-- 老師/同工全看；家長看自己孩子的授權（出席頁只顯示已授權項目）
create policy "child_permissions_read" on child_service_permissions
  for select to authenticated
  using (public.is_staff() or child_id in (select public.my_child_ids()));
-- 開通/移除：同工或該班老師（沿用 P-03 授權範圍）
create policy "child_permissions_insert" on child_service_permissions
  for insert to authenticated
  with check (public.is_admin() or public.child_in_my_class(child_id));
create policy "child_permissions_delete" on child_service_permissions
  for delete to authenticated
  using (public.is_admin() or public.child_in_my_class(child_id));

-- 5) 家長報名改為逐項檢查：孩子必須具「該項目」的授權
drop policy if exists "child_signups_insert" on child_service_signups;
create policy "child_signups_insert" on child_service_signups
  for insert to authenticated
  with check (
    exists (
      select 1 from child_service_permissions p
      where p.child_id = child_service_signups.child_id
        and p.item = child_service_signups.item
    )
    and (public.is_admin() or child_id in (select public.my_child_ids()))
  );

notify pgrst, 'reload schema';
