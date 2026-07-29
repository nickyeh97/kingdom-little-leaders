-- =========================================================
-- Migration：支援 Google 註冊/登入
-- Google OAuth 使用者的名稱存在 raw_user_meta_data 的 full_name / name，
-- 擴充 handle_new_user 的 display_name 來源優先序：
--   display_name（Email 註冊表單）→ full_name / name（Google）→ email 前綴
-- 另需於 Dashboard 啟用 Google Provider（見 README「Google 登入設定」）
-- 適用：已執行 2026-07-29_songs.sql 的資料庫
-- =========================================================

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
