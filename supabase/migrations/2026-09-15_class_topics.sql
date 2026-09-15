-- 需求增補 v16 #1：服事表顯示「預排主題」
--
-- ## 為什麼另開一張表，而不是沿用 service_weeks.topic
--
-- `service_weeks` 早就有 `topic` 欄位，服事卡上也已經有「📖 主題」的渲染，
-- 但實際上沒人用得起來，原因有兩個：
--
-- 1. **被發布鎖住**：`service_weeks_read` 的條件是
--    `is_admin() or (is_staff() and published)`——老師要等同工按下「發布」才看得到主題。
--    但老師需要主題的時機，正是「決定要不要報名這一週」的時候，那時還沒發布。
--
-- 2. **生命週期不一樣**：主題是**學期初一次排完整年**的（教會的 Google Sheet 上排到 11 月以後），
--    服事則是**每週才安排**。主題掛在 service_weeks 上，等於逼同工「為了記一個主題，
--    先去安排一整週的服事」。正式資料佐證：service_weeks 只有 4 筆，其中只有 1 筆填了 topic。
--
-- 所以把主題獨立成自己的表，讀取權限放寬到全體同工與老師，寫入仍限同工。
--
-- ## 既有資料
--
-- 下面會把 service_weeks 裡已填的 topic 搬過來。
-- `service_weeks.topic` 欄位**保留不刪**（舊資料與既有匯出仍在），但不再是編輯來源——
-- 服事頁的「安排」彈窗已移除該欄位，避免同一件事有兩個地方可以改。

create table if not exists class_topics (
  id uuid primary key default gen_random_uuid(),
  gathering_date date not null,
  class_group_id uuid not null references class_groups (id) on delete cascade,
  topic text not null default '',
  -- 可為 null：`auth.uid()` 只在「從平台寫入」時有值。
  -- 這支 migration 最後會把 service_weeks 的舊 topic 搬過來，那是在 SQL Editor 裡執行的，
  -- 沒有登入的 JWT → auth.uid() 回 NULL → 若設 not null 整支 migration 會失敗。
  -- 搬過來的資料本來就不是任何人在平台上填的，記成 null 才誠實；
  -- 畫面顯示用的是下面的 updated_by_name 快照。
  updated_by uuid references profiles (id),
  updated_by_name text not null default '',
  updated_at timestamptz not null default now(),
  unique (gathering_date, class_group_id)
);
create index if not exists idx_class_topics_date on class_topics (gathering_date);

-- 保險：Supabase SQL Editor 是包在交易裡跑的，前一次失敗會整支回滾、表根本不會留下來；
-- 但若在非交易環境下跑過並留下 not null 的舊表，這行會把它放寬，讓整支 migration 可以直接重跑
alter table class_topics alter column updated_by drop not null;

comment on table class_topics is
  '預排主題（聚會日 × 班別）。學期初一次排完，讓老師在報名服事前就知道那週要帶什麼。'
  '與 service_weeks 的排班脫鉤：不需要先安排服事、也不需要發布，老師就看得到。';

alter table class_topics enable row level security;

-- 讀：全體同工與老師。主題不是敏感資料，而且老師要在報名前就看得到，不能綁發布狀態
drop policy if exists "class_topics_read" on class_topics;
create policy "class_topics_read" on class_topics
  for select to authenticated using (public.is_staff());

-- 寫：僅同工（組長定案：管理員可編輯+查看、老師僅查看）
drop policy if exists "class_topics_write" on class_topics;
create policy "class_topics_write" on class_topics
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 更新時間戳（比照 lesson_segments 的既有做法）
create or replace function public.touch_class_topic()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_touch_class_topic on class_topics;
create trigger trg_touch_class_topic before update on class_topics
  for each row execute function public.touch_class_topic();

-- 搬移既有的 service_weeks.topic（只搬有填的；重跑不會重複）
insert into class_topics (gathering_date, class_group_id, topic)
select w.gathering_date, w.class_group_id, btrim(w.topic)
from service_weeks w
where btrim(w.topic) <> ''
on conflict (gathering_date, class_group_id) do nothing;

comment on column service_weeks.topic is
  '已由 class_topics 取代（v16 #1），保留僅為舊資料與既有匯出。新的編輯一律寫入 class_topics。';
