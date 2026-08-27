-- Sprint 06：本週歌曲（組長 0827 反饋 #1）
-- 於 Supabase SQL Editor 執行。
--
-- 歌單內可勾選多首「本週歌曲」，詩歌頁置頂顯示；
-- 資料掛在歌單×曲目關聯上（playlist_songs），RLS 沿用既有政策不變。

alter table playlist_songs
  add column if not exists is_weekly boolean not null default false;

notify pgrst, 'reload schema';
