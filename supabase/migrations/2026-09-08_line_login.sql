-- 需求增補 v15 #1：LINE 登入（綁定式）
--
-- 只補一個 handle_new_user 的破口，沒有新資料表——
-- LINE 綁定本身走 Supabase Auth 的 identity 機制，不需要平台自己存東西。
--
-- ## 為什麼要改 handle_new_user
--
-- `profiles.display_name` 是 `not null`，而原本的 coalesce 鏈最後一段是
-- `split_part(new.email, '@', 1)`。Email 與 Google 一定有 email，所以這條鏈永遠有值。
--
-- **LINE 是第一個 email 可能為 NULL 的管道**：`email` scope 要另外向 LINE 申請核准，
-- 使用者也可以拒絕授權。真的三個來源都空的話，`split_part(NULL, '@', 1)` 回 NULL
-- → INSERT 違反 not null → **整個註冊交易失敗**，使用者只會看到一個沒頭沒尾的錯誤。
--
-- 實務上 LINE 的 profile scope 會給 name，所以踩到的機率低；
-- 但這是「一踩就完全登不進來」的破口，補一個字串保底比事後查便宜太多。
--
-- 順帶把註解裡的 provider 例子補上 LINE 實際會寫入的值。
-- Supabase 自訂 provider 的 `raw_app_meta_data->>'provider'` 是 `custom:line`（含前綴）。

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
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '新成員' -- 保底：LINE 可能同時沒有 email 也沒有 name，不能讓註冊整個失敗
    ),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email') -- email / google / custom:line
  );
  return new;
end;
$$;

comment on column public.profiles.auth_provider is
  '註冊管道：email / google / custom:line（Supabase 自訂 provider 帶 custom: 前綴）。'
  '此欄位記錄的是「第一次註冊時用哪個管道」，之後追加綁定的登入方式不會改動它——'
  '要看某人綁了哪些登入方式請查 auth.identities。';
