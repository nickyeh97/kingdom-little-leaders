import { db } from '../lib/supabase'
import type { AttendancePlan, AttendanceStatus, Child } from '../types'

/** 家長端：取得自己綁定的孩子（RLS 已限制只回自己的） */
export async function listMyChildren(): Promise<Child[]> {
  const { data, error } = await db()
    .from('children')
    .select('*, class_groups(*)')
    .order('name')
  if (error) throw error
  return data as Child[]
}

/** 取得某主日的預先出席（RLS：家長只拿得到自己孩子的） */
export async function listPlans(sundayDate: string): Promise<AttendancePlan[]> {
  const { data, error } = await db()
    .from('attendance_plans')
    .select('*')
    .eq('sunday_date', sundayDate)
  if (error) throw error
  return data as AttendancePlan[]
}

/** 家長送出：一次 upsert 多個孩子的狀態 */
export async function upsertPlans(
  sundayDate: string,
  statuses: { child_id: string; status: AttendanceStatus }[],
): Promise<void> {
  const rows = statuses.map((s) => ({ ...s, sunday_date: sundayDate }))
  const { error } = await db()
    .from('attendance_plans')
    .upsert(rows, { onConflict: 'child_id,sunday_date' })
  if (error) throw error
}

/** 統計某主日預計出席人數（老師/管理端） */
export async function countAttending(sundayDate: string): Promise<number> {
  const { count, error } = await db()
    .from('attendance_plans')
    .select('*', { count: 'exact', head: true })
    .eq('sunday_date', sundayDate)
    .eq('status', 'attending')
  if (error) throw error
  return count ?? 0
}
