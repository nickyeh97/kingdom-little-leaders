-- 服事經歷卡電子版「小領袖靈獸」（遊戲 repo：nickyeh97/kingdom-spirits，GDD §6.1）
--
-- 遊戲以家長的 access token 直接呼叫 Supabase REST，**安全邊界就是這裡的 RLS**。
-- 組長裁決（2026-09-17／09-30）：
--   * 紀錄時間＝家長按下儲存的時刻（created_at），不與聚會日或服事週期關聯 → 沒有 gathering_date
--   * 該班老師可唯讀（關懷、與紙本核對）；登錄一律由家長
--   * 等級（次數＋1）與靈獸階段是派生值，不存資料庫，由遊戲與平台各自從紀錄計算
-- 守則：只記孩子自己的軌跡，不做任何跨孩子的彙總或排行（紅燈 #1）。
--
-- 整支可重跑（if not exists／drop … if exists）。

-- 鼓勵話語：家長預先寫好、遊戲輪流顯示。1–5 句、每句 1–40 字（GDD §3.5）
create or replace function public.valid_encouragements(j jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(j) = 'array'
     and jsonb_array_length(j) <= 5
     and not exists (
       select 1 from jsonb_array_elements(j) e
       where jsonb_typeof(e) <> 'string'
          or char_length(btrim(e #>> '{}')) = 0
          or char_length(e #>> '{}') > 40
     )
$$;

-- 服事經歷卡：家長看到紙本卡上老師的簽名後，每登錄一次服事一筆
create table if not exists service_card_entries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  -- 值同 child_service_items.name。不設 FK：與 child_service_* 各表一致，項目改名不搬移舊紀錄
  item text not null,
  -- 聖靈果子反思（加拉太書 5:22–23），孩子可跳過。只給孩子自己回味，不計分、不統計
  fruit text check (fruit in ('仁愛','喜樂','和平','忍耐','恩慈','良善','信實','溫柔','節制')),
  recorded_by uuid not null default auth.uid() references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists idx_service_card_child on service_card_entries (child_id, created_at);

comment on table service_card_entries is
  '服事經歷卡（小領袖靈獸）：每筆＝家長確認紙本卡老師簽名後登錄的一次服事；created_at 即紀錄時間。';

-- 靈獸設定：每孩一筆。外觀由遊戲寫入，鼓勵話語由平台（家長）寫入
create table if not exists beast_profiles (
  child_id uuid primary key references children (id) on delete cascade,
  variant text not null check (variant in ('lamb','dove','lion','deer','eagle','fish')),
  palette text not null default 'p1' check (palette ~ '^p[1-8]$'),
  encouragements jsonb not null default '[]'::jsonb check (public.valid_encouragements(encouragements)),
  -- 不加 not null：SQL Editor 整理資料時沒有 JWT
  updated_by uuid default auth.uid() references profiles (id),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_beast_profile()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end $$;
drop trigger if exists trg_touch_beast_profile on beast_profiles;
create trigger trg_touch_beast_profile before update on beast_profiles
  for each row execute function public.touch_beast_profile();

-- ---- RLS ----
alter table service_card_entries enable row level security;

-- 讀：綁定家長、該班老師（唯讀關懷）、同工
drop policy if exists "service_card_read" on service_card_entries;
create policy "service_card_read" on service_card_entries
  for select to authenticated
  using (
    child_id in (select public.my_child_ids())
    or public.child_in_my_class(child_id)
    or public.is_admin()
  );

-- 新增：綁定家長（或同工），只能記成自己，且項目必須是字典裡啟用中的項目
drop policy if exists "service_card_insert" on service_card_entries;
create policy "service_card_insert" on service_card_entries
  for insert to authenticated
  with check (
    (child_id in (select public.my_child_ids()) or public.is_admin())
    and recorded_by = auth.uid()
    and exists (select 1 from child_service_items i where i.name = item and i.active)
  );

-- 刪除（誤登更正）：家長只能刪自己登錄的；同工可刪全部。不開放修改
drop policy if exists "service_card_delete" on service_card_entries;
create policy "service_card_delete" on service_card_entries
  for delete to authenticated
  using (
    (child_id in (select public.my_child_ids()) and recorded_by = auth.uid())
    or public.is_admin()
  );

alter table beast_profiles enable row level security;

drop policy if exists "beast_profiles_read" on beast_profiles;
create policy "beast_profiles_read" on beast_profiles
  for select to authenticated
  using (child_id in (select public.my_child_ids()) or public.is_admin());

drop policy if exists "beast_profiles_insert" on beast_profiles;
create policy "beast_profiles_insert" on beast_profiles
  for insert to authenticated
  with check (child_id in (select public.my_child_ids()));

drop policy if exists "beast_profiles_update" on beast_profiles;
create policy "beast_profiles_update" on beast_profiles
  for update to authenticated
  using (child_id in (select public.my_child_ids()))
  with check (child_id in (select public.my_child_ids()));
