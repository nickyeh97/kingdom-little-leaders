/**
 * 執行環境判斷：測試站（npm run dev:staging）不得連到正式資料庫。
 *
 * 2026-11-01 實際發生過：.env.staging.local 沒讀到，測試站照樣連正式資料庫，
 * 用 Google 登入後被導回正式網站——在測試站按的任何東西都會寫進正式資料。
 * 所以 staging 模式遇到正式資料庫的網址，直接不建立連線（登入頁顯示原因）。
 * 正式資料庫的網址是公開值（平台網頁本來就帶著），寫在這裡不涉及機密。
 */
export const PRODUCTION_SUPABASE_HOST = 'bazvzaqetvjpnanabkox.supabase.co'

/** https://xxx.supabase.co/ → xxx.supabase.co；沒設定回空字串 */
export function supabaseHost(url: string | undefined): string {
  return (url ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

/** 測試站（mode=staging）卻設定成正式資料庫 */
export function stagingPointsToProduction(mode: string, url: string | undefined): boolean {
  return mode === 'staging' && supabaseHost(url) === PRODUCTION_SUPABASE_HOST
}
