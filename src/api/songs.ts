import { db } from '../lib/supabase'
import type { Song } from '../types'

export async function listSongs(gatheringDate: string): Promise<Song[]> {
  const { data, error } = await db()
    .from('songs')
    .select('*')
    .eq('gathering_date', gatheringDate)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data as Song[]
}

export interface SongInput {
  gathering_date: string
  title: string
  youtube_url: string | null
  lyrics: string | null
  sort_order: number
}

export async function createSong(input: SongInput): Promise<void> {
  const { error } = await db().from('songs').insert(input)
  if (error) throw error
}

export async function updateSong(id: string, patch: SongInput): Promise<void> {
  const { error } = await db().from('songs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await db().from('songs').delete().eq('id', id)
  if (error) throw error
}
