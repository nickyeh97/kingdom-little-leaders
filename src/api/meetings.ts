import { db } from '../lib/supabase'
import type { Meeting, MeetingItem, OrgUnit } from '../types'

/** 全部可見會議（RLS 依 scope 過濾），含事項；新會議在前 */
export async function listMeetings(): Promise<Meeting[]> {
  const { data, error } = await db()
    .from('meetings')
    .select('*, meeting_items(*)')
    .order('meeting_date', { ascending: false })
  if (error) throw error
  return data as Meeting[]
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
