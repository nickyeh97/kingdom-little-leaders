import { db } from '../lib/supabase'
import type { Announcement } from '../types'

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await db()
    .from('announcements')
    .select('*, class_groups(name)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Announcement[]
}

export interface AnnouncementInput {
  title: string
  body: string
  tag: string
  /** 班別歸屬：null＝全體公告；各班老師必填自己的班別（RLS 強制） */
  class_group_id: string | null
  pinned: boolean
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  const { error } = await db().from('announcements').insert(input)
  if (error) throw error
}

export async function updateAnnouncement(id: string, patch: AnnouncementInput): Promise<void> {
  const { error } = await db().from('announcements').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await db().from('announcements').delete().eq('id', id)
  if (error) throw error
}
