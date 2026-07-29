import { db } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

/** 管理端：全部成員（RLS：僅 admin 拿得到全部） */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await db().from('profiles').select('*').order('created_at')
  if (error) throw error
  return data as Profile[]
}

/** 管理端：整組覆寫成員的角色標籤 */
export async function updateRoles(profileId: string, roles: UserRole[]): Promise<void> {
  const { error } = await db().from('profiles').update({ roles }).eq('id', profileId)
  if (error) throw error
}

/** 管理端：核准/取消核准成員 */
export async function updateApproved(profileId: string, approved: boolean): Promise<void> {
  const { error } = await db().from('profiles').update({ approved }).eq('id', profileId)
  if (error) throw error
}

/**
 * 管理端：刪除成員（profiles 列與家庭綁定一併移除）。
 * 注意：Auth 登入帳號需於 Supabase 後台或未來 Edge Function 清除，
 * 但該帳號已無 profile，登入後形同未審核、無任何資料存取權。
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await db().from('profiles').delete().eq('id', profileId)
  if (error) throw error
}
