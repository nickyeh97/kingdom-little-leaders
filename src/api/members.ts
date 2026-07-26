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
