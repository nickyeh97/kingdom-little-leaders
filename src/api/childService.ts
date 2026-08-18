import { db } from '../lib/supabase'
import type { ChildServiceRoster, ChildServiceSignup } from '../types'

/** 服事資格開關（P-03 進階）：該班老師或同工（RPC 內強制授權） */
export async function setChildServiceEligible(childId: string, flag: boolean): Promise<void> {
  const { error } = await db().rpc('set_child_service_eligible', { cid: childId, flag })
  if (error) throw error
}

/** 期間內兒童服事報名（RLS：家長只拿得到自己孩子的；老師/同工全看） */
export async function listChildSignups(from: string, to: string): Promise<ChildServiceSignup[]> {
  const { data, error } = await db()
    .from('child_service_signups')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
  if (error) throw error
  return data as ChildServiceSignup[]
}

/** 家長為孩子報名（P-04；孩子需具服事資格，RLS 強制） */
export async function addChildSignup(input: {
  child_id: string
  gathering_date: string
  item: string
  note: string | null
}): Promise<void> {
  const { error } = await db().from('child_service_signups').insert(input)
  if (error) throw error
}

export async function removeChildSignup(id: string): Promise<void> {
  const { error } = await db().from('child_service_signups').delete().eq('id', id)
  if (error) throw error
}

/** 期間內兒童服事表（RLS：未發布僅同工可見），含排班名單 */
export async function listChildRosters(from: string, to: string): Promise<ChildServiceRoster[]> {
  const { data, error } = await db()
    .from('child_service_rosters')
    .select('*, child_service_assignments(*)')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
  if (error) throw error
  return data as ChildServiceRoster[]
}

/** 同工建立/更新某週某班的兒童服事表（含發布狀態），回傳 id */
export async function upsertChildRoster(input: {
  gathering_date: string
  class_group_id: string
  published: boolean
}): Promise<string> {
  const { data, error } = await db()
    .from('child_service_rosters')
    .upsert(input, { onConflict: 'gathering_date,class_group_id' })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

/** 同工整組覆寫兒童排班（依傳入順序寫 sort_order；child_name 快照） */
export async function setChildAssignments(
  rosterId: string,
  entries: { child_id: string | null; child_name: string; item: string }[],
): Promise<void> {
  const client = db()
  const { error: delError } = await client
    .from('child_service_assignments')
    .delete()
    .eq('roster_id', rosterId)
  if (delError) throw delError
  if (entries.length === 0) return
  const { error } = await client
    .from('child_service_assignments')
    .insert(entries.map((e, i) => ({ ...e, roster_id: rosterId, sort_order: i })))
  if (error) throw error
}
