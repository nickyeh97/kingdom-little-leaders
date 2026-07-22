import { db } from '../lib/supabase'
import type { Announcement } from '../types'

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await db()
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Announcement[]
}

export async function createAnnouncement(input: {
  title: string
  body: string
  tag: string
  pinned: boolean
}): Promise<void> {
  const { error } = await db().from('announcements').insert(input)
  if (error) throw error
}
