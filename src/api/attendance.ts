import { db } from '../lib/supabase'
import type { AttendancePlan, AttendanceStatus, Child } from '../types'

/**
 * 出席頁專用：嚴格只取「自己綁定」的孩子（走 family_links 明確過濾本人）。
 * 老師/同工雖可讀全部孩子（點名用），但出席頁不得顯示未綁定的孩子——
 * 預約狀況請至點名（簽到）頁查看（規格書 v3 決議 1）。
 */
export async function listMyChildren(): Promise<Child[]> {
  const client = db()
  const uid = (await client.auth.getSession()).data.session?.user.id
  if (!uid) return []
  const { data, error } = await client
    .from('family_links')
    .select('children(*, class_groups(*))')
    .eq('parent_id', uid)
  if (error) throw error
  const kids = (data ?? []).map((r) => r.children as unknown as Child)
  return kids.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
}

/** 取得某主日的預先出席（RLS：家長只拿得到自己孩子的） */
export async function listPlans(gatheringDate: string): Promise<AttendancePlan[]> {
  const { data, error } = await db()
    .from('attendance_plans')
    .select('*')
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return data as AttendancePlan[]
}

/** 取得日期區間的預先出席（出席行事曆用；RLS：家長只拿得到自己孩子的） */
export async function listPlansRange(from: string, to: string): Promise<AttendancePlan[]> {
  const { data, error } = await db()
    .from('attendance_plans')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
  if (error) throw error
  return data as AttendancePlan[]
}

/** 家長送出：一次 upsert 多個孩子的狀態＋給老師的話 */
export async function upsertPlans(
  gatheringDate: string,
  entries: { child_id: string; status: AttendanceStatus; note: string | null }[],
): Promise<void> {
  const rows = entries.map((e) => ({ ...e, gathering_date: gatheringDate }))
  const { error } = await db()
    .from('attendance_plans')
    .upsert(rows, { onConflict: 'child_id,gathering_date' })
  if (error) throw error
}

/** 統計某主日預計出席人數（老師/管理端） */
export async function countAttending(gatheringDate: string): Promise<number> {
  const { count, error } = await db()
    .from('attendance_plans')
    .select('*', { count: 'exact', head: true })
    .eq('gathering_date', gatheringDate)
    .eq('status', 'attending')
  if (error) throw error
  return count ?? 0
}
