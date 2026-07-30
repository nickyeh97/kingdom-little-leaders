import { db } from '../lib/supabase'
import type { Song } from '../types'

/** 曲庫全列表（越新越上面），連同排程與各班熟悉度 */
export async function listSongs(): Promise<Song[]> {
  const { data, error } = await db()
    .from('songs')
    .select('*, song_schedule(*), song_familiarity(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Song[]
}

export interface SongInput {
  title: string
  youtube_url: string | null
  dance_url: string | null
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

/**
 * 重設某首歌在指定聚會日範圍內的排程（班別 × 聚會日）。
 * 只動 `dates` 內的排程（編輯視窗僅涵蓋本週/下週），歷史排程保留。
 */
export async function setSongSchedule(
  songId: string,
  dates: string[],
  entries: { class_group_id: string; gathering_date: string }[],
): Promise<void> {
  const client = db()
  const { error: delError } = await client
    .from('song_schedule')
    .delete()
    .eq('song_id', songId)
    .in('gathering_date', dates)
  if (delError) throw delError
  if (entries.length === 0) return
  const { error } = await client
    .from('song_schedule')
    .insert(entries.map((e) => ({ ...e, song_id: songId })))
  if (error) throw error
}

/** 老師於日誌流程填寫：某班對某歌的兩維熟悉度（null＝未填） */
export async function upsertFamiliarity(
  songId: string,
  classGroupId: string,
  songLevel: number | null,
  motionLevel: number | null,
): Promise<void> {
  const { error } = await db()
    .from('song_familiarity')
    .upsert(
      {
        song_id: songId,
        class_group_id: classGroupId,
        song_level: songLevel,
        motion_level: motionLevel,
      },
      { onConflict: 'song_id,class_group_id' },
    )
  if (error) throw error
}

/** 某班某聚會日的排程歌單（課堂紀錄填熟悉度用） */
export async function listScheduledSongs(
  classGroupId: string,
  gatheringDate: string,
): Promise<Song[]> {
  const { data, error } = await db()
    .from('song_schedule')
    .select('songs(*, song_familiarity(*))')
    .eq('class_group_id', classGroupId)
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return (data ?? []).map((r) => r.songs as unknown as Song)
}
