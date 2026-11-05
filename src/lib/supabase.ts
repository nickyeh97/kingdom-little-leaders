import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { stagingPointsToProduction } from './environment'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 測試站設定成正式資料庫：拒絕連線（見 lib/environment.ts） */
export const stagingBlocked = stagingPointsToProduction(import.meta.env.MODE, url)

/** 未設定環境變數（或測試站誤設正式資料庫）時為 null；登入頁會顯示設定指引，避免整個 App 崩潰 */
export const supabase: SupabaseClient | null =
  url && anonKey && !stagingBlocked ? createClient(url, anonKey) : null

export const isConfigured = supabase !== null

/** 需要 client 的場景使用；未設定時直接丟錯，由呼叫端 toast */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase 尚未設定（缺少 .env.local）')
  return supabase
}
