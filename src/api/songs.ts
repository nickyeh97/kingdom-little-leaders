import { db } from '../lib/supabase'
import type { Song, SongPlaylist } from '../types'

/** 曲庫全列表（越新越上面），連同各班熟悉度 */
export async function listSongs(): Promise<Song[]> {
  const { data, error } = await db()
    .from('songs')
    .select('*, song_familiarity(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Song[]
}

export interface SongInput {
  title: string
  youtube_url: string | null // 連結（純歌詞）
  dance_url: string | null // 連結（有動作）
  lyrics: string | null
}

export async function createSong(input: SongInput): Promise<string> {
  const { data, error } = await db().from('songs').insert(input).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateSong(id: string, patch: SongInput): Promise<void> {
  const { error } = await db().from('songs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await db().from('songs').delete().eq('id', id)
  if (error) throw error
}

// ---- 歌單期間（班別 × 期間，如「2026年7-8月」；v4 決議 4 以班別區分）----

/** 全部歌單（新期間在前），含歌曲順序 */
export async function listPlaylists(): Promise<SongPlaylist[]> {
  const { data, error } = await db()
    .from('song_playlists')
    .select('*, playlist_songs(song_id, sort_order, is_weekly)')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as SongPlaylist[]
}

export interface PlaylistInput {
  class_group_id: string
  title: string
  start_date: string
  end_date: string
}

export async function createPlaylist(input: PlaylistInput): Promise<string> {
  const { data, error } = await db()
    .from('song_playlists')
    .insert(input)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updatePlaylist(id: string, patch: PlaylistInput): Promise<void> {
  const { error } = await db().from('song_playlists').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePlaylist(id: string): Promise<void> {
  const { error } = await db().from('song_playlists').delete().eq('id', id)
  if (error) throw error
}

/** 重設歌單曲目（依傳入順序寫 sort_order） */
export async function setPlaylistSongs(
  playlistId: string,
  entries: { song_id: string; is_weekly: boolean }[],
): Promise<void> {
  const client = db()
  const { error: delError } = await client
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
  if (delError) throw delError
  if (entries.length === 0) return
  const { error } = await client
    .from('playlist_songs')
    .insert(entries.map((e, i) => ({ playlist_id: playlistId, ...e, sort_order: i })))
  if (error) throw error
}

/** 某班某日期所屬歌單的曲目（課堂紀錄填熟悉度用） */
export async function listCurrentPlaylistSongs(
  classGroupId: string,
  onDate: string,
): Promise<Song[]> {
  const { data, error } = await db()
    .from('song_playlists')
    .select('playlist_songs(sort_order, songs(*, song_familiarity(*)))')
    .eq('class_group_id', classGroupId)
    .lte('start_date', onDate)
    .gte('end_date', onDate)
  if (error) throw error
  const rows = (data ?? []).flatMap(
    (pl) => (pl.playlist_songs ?? []) as { sort_order: number; songs: unknown }[],
  )
  return rows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.songs as Song)
    .filter(Boolean)
}

/**
 * 老師填熟悉度（詩歌頁或日誌流程；v4 決議 3）。
 * 填寫人以快照存名；lastPracticedOn＝上課日期（日誌流程帶入，詩歌頁可不帶）
 */
export async function upsertFamiliarity(
  songId: string,
  classGroupId: string,
  songLevel: number | null,
  motionLevel: number | null,
  updatedByName: string,
  lastPracticedOn?: string | null,
): Promise<void> {
  const row: Record<string, unknown> = {
    song_id: songId,
    class_group_id: classGroupId,
    song_level: songLevel,
    motion_level: motionLevel,
    updated_by_name: updatedByName,
  }
  if (lastPracticedOn !== undefined) row.last_practiced_on = lastPracticedOn
  const { error } = await db()
    .from('song_familiarity')
    .upsert(row, { onConflict: 'song_id,class_group_id' })
  if (error) throw error
}
