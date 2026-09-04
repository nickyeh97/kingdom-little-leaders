import { db } from '../lib/supabase'
import type { Meeting, MeetingItem, MeetingLink, OrgUnit } from '../types'

/**
 * 全部可見會議（RLS 依 scope 過濾），含事項與附件連結；新會議在前。
 *
 * meeting_links 是後加的（v11 #11）。migration 尚未執行的環境裡，
 * PostgREST 找不到這層關聯會整個查詢回 400——**連會議本體都讀不到**。
 * 所以查不到關聯時退回不帶連結的查詢：頁面照常可用，只是沒有連結區。
 */
export async function listMeetings(): Promise<Meeting[]> {
  const base = db().from('meetings')
  const { data, error } = await base
    .select('*, meeting_items(*), meeting_links(*)')
    .order('meeting_date', { ascending: false })
  if (!error) return data as Meeting[]
  // PGRST200＝找不到關聯（meeting_links 還沒建表）；其他錯誤照常拋出
  if (error.code !== 'PGRST200') throw error
  const fallback = await db()
    .from('meetings')
    .select('*, meeting_items(*)')
    .order('meeting_date', { ascending: false })
  if (fallback.error) throw fallback.error
  return fallback.data as Meeting[]
}

export interface MeetingInput {
  scope: 'all' | 'staff' | 'class'
  class_group_id: string | null
  meeting_date: string
  title: string
  minutes: string
  created_by_name: string
}

export async function createMeeting(input: MeetingInput): Promise<string> {
  const { data, error } = await db().from('meetings').insert(input).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateMeeting(id: string, patch: Partial<MeetingInput>): Promise<void> {
  const { error } = await db().from('meetings').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await db().from('meetings').delete().eq('id', id)
  if (error) throw error
}

// ---- 會議附件連結（v11 #11）----
// 檔案本體放教會 NAS / Google 雲端（CLAUDE.md 決議 11：平台不自建檔案儲存），
// 這裡只存標題與網址；網址在寫入前先過 normalizeUrl，避免漏打 https:// 變成站內路徑。

export interface MeetingLinkInput {
  meeting_id: string
  title: string
  url: string
  sort_order: number
}

export async function createMeetingLink(input: MeetingLinkInput): Promise<MeetingLink> {
  const { data, error } = await db().from('meeting_links').insert(input).select().single()
  if (error) throw error
  return data as MeetingLink
}

export async function updateMeetingLink(
  id: string,
  patch: Partial<MeetingLinkInput>,
): Promise<void> {
  const { error } = await db().from('meeting_links').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMeetingLink(id: string): Promise<void> {
  const { error } = await db().from('meeting_links').delete().eq('id', id)
  if (error) throw error
}

export interface MeetingItemInput {
  meeting_id: string
  content: string
  assignee: string
  due_date: string | null
  status: MeetingItem['status']
  sort_order: number
}

export async function createMeetingItem(input: MeetingItemInput): Promise<void> {
  const { error } = await db().from('meeting_items').insert(input)
  if (error) throw error
}

export async function updateMeetingItem(
  id: string,
  patch: Partial<MeetingItemInput>,
): Promise<void> {
  const { error } = await db().from('meeting_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMeetingItem(id: string): Promise<void> {
  const { error } = await db().from('meeting_items').delete().eq('id', id)
  if (error) throw error
}

// ---- 組織架構／分工（C-06）----

export async function listOrgUnits(): Promise<OrgUnit[]> {
  const { data, error } = await db().from('org_units').select('*').order('sort_order')
  if (error) throw error
  return data as OrgUnit[]
}

export interface OrgUnitInput {
  title: string
  members_text: string
  note: string
  sort_order: number
}

export async function createOrgUnit(input: OrgUnitInput): Promise<void> {
  const { error } = await db().from('org_units').insert(input)
  if (error) throw error
}

export async function updateOrgUnit(id: string, patch: Partial<OrgUnitInput>): Promise<void> {
  const { error } = await db().from('org_units').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteOrgUnit(id: string): Promise<void> {
  const { error } = await db().from('org_units').delete().eq('id', id)
  if (error) throw error
}
