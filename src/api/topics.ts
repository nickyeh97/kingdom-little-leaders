/**
 * 預排主題（v16 #1）。
 *
 * 與 `service_weeks` 的排班脫鉤：不需要先安排服事、也不需要發布，
 * 老師在報名前就看得到那一週要帶什麼（RLS：`is_staff()` 可讀、`is_admin()` 可寫）。
 */
import { db } from '../lib/supabase'
import type { ClassTopic } from '../types'

/**
 * PostgREST 在「資料表還不存在」時回 PGRST205。
 *
 * 服事頁是 `Promise.all` 一次載入所有資料，這支若直接 throw，整頁會白掉——
 * 上次 `meeting_links` 就是這樣把開會決議頁弄壞的（PGRST200）。
 * migration 還沒跑就當作「還沒有任何主題」，其他區塊照常運作。
 */
const TABLE_MISSING = 'PGRST205'

export async function listClassTopics(from: string, to: string): Promise<ClassTopic[]> {
  const { data, error } = await db()
    .from('class_topics')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
  if (error) {
    if (error.code === TABLE_MISSING) return []
    throw error
  }
  return data as ClassTopic[]
}

export interface ClassTopicInput {
  gathering_date: string
  class_group_id: string
  topic: string
  updated_by_name: string
}

/**
 * 寫入一筆主題。
 *
 * 清空內容就把整列刪掉，而不是留一列空字串——不然「有沒有排過主題」會分不出來，
 * 畫面上也會多一列什麼都沒有的紀錄。
 */
export async function upsertClassTopic(input: ClassTopicInput): Promise<void> {
  const topic = input.topic.trim()
  if (!topic) {
    const { error } = await db()
      .from('class_topics')
      .delete()
      .eq('gathering_date', input.gathering_date)
      .eq('class_group_id', input.class_group_id)
    if (error) throw error
    return
  }
  const { error } = await db()
    .from('class_topics')
    .upsert(
      {
        gathering_date: input.gathering_date,
        class_group_id: input.class_group_id,
        topic,
        updated_by_name: input.updated_by_name,
      },
      { onConflict: 'gathering_date,class_group_id' },
    )
  if (error) throw error
}
