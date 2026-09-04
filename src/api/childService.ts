import { db } from '../lib/supabase'
import type { ChildServiceItem, ChildServicePermission, ChildServiceRoster, ChildServiceSignup } from '../types'

// ---- 服事項目授權（v5 #3：逐項開通，取代整體開關）----

/** 授權清單（RLS：家長只拿得到自己孩子的；老師/同工全看） */
export async function listChildPermissions(): Promise<ChildServicePermission[]> {
  const { data, error } = await db().from('child_service_permissions').select('*')
  if (error) throw error
  return data as ChildServicePermission[]
}

/** 開通某孩子的某服事項目（RLS：該班老師或同工）；children.service_eligible 由觸發器同步 */
export async function addChildPermission(
  childId: string,
  item: string,
  createdByName: string,
): Promise<void> {
  const { error } = await db()
    .from('child_service_permissions')
    .insert({ child_id: childId, item, created_by_name: createdByName })
  if (error) throw error
}

export async function removeChildPermission(id: string): Promise<void> {
  const { error } = await db().from('child_service_permissions').delete().eq('id', id)
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

// ---- 兒童服事項目字典（v11 #4）----
// 名稱與說明由同工維護；授權（名單頁）與報名（服事頁）的勾選按鈕都讀這張表。

export async function listChildServiceItems(): Promise<ChildServiceItem[]> {
  const { data, error } = await db()
    .from('child_service_items')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as ChildServiceItem[]
}

export interface ChildServiceItemInput {
  name: string
  description: string
  sort_order: number
  active: boolean
}

export async function createChildServiceItem(input: ChildServiceItemInput): Promise<void> {
  const { error } = await db().from('child_service_items').insert(input)
  if (error) throw error
}

export async function updateChildServiceItem(
  id: string,
  patch: Partial<ChildServiceItemInput>,
): Promise<void> {
  const { error } = await db().from('child_service_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChildServiceItem(id: string): Promise<void> {
  const { error } = await db().from('child_service_items').delete().eq('id', id)
  if (error) throw error
}
