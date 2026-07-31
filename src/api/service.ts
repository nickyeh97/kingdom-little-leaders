import { db } from '../lib/supabase'
import type { ServiceWeek, TeacherServiceSignup } from '../types'

/** 期間內的服事內容（老師端 RLS 只回已發布；同工全看），含排班結果 */
export async function listServiceWeeks(from: string, to: string): Promise<ServiceWeek[]> {
  const { data, error } = await db()
    .from('service_weeks')
    .select('*, service_assignments(*)')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
  if (error) throw error
  return data as ServiceWeek[]
}

export interface ServiceWeekInput {
  gathering_date: string
  class_group_id: string
  songs_text: string
  topic: string
  flex_text: string
  published: boolean
}

/** 同工建立/更新某週某班的服事內容（含發布狀態），回傳 id */
export async function upsertServiceWeek(input: ServiceWeekInput): Promise<string> {
  const { data, error } = await db()
    .from('service_weeks')
    .upsert(input, { onConflict: 'gathering_date,class_group_id' })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

/** 同工整組覆寫某週某班的排班（依傳入順序寫 sort_order） */
export async function setAssignments(
  serviceWeekId: string,
  entries: { teacher_id: string | null; teacher_name: string; item: string }[],
): Promise<void> {
  const client = db()
  const { error: delError } = await client
    .from('service_assignments')
    .delete()
    .eq('service_week_id', serviceWeekId)
  if (delError) throw delError
  if (entries.length === 0) return
  const { error } = await client
    .from('service_assignments')
    .insert(entries.map((e, i) => ({ ...e, service_week_id: serviceWeekId, sort_order: i })))
  if (error) throw error
}

/** 期間內全部老師的服事報名（T-COM-02） */
export async function listSignups(from: string, to: string): Promise<TeacherServiceSignup[]> {
  const { data, error } = await db()
    .from('teacher_service_signups')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
  if (error) throw error
  return data as TeacherServiceSignup[]
}

/** 老師報名（T-COM-01；teacher_name 快照由呼叫端帶入） */
export async function addSignup(input: {
  teacher_name: string
  gathering_date: string
  class_group_id: string
  item: string
  note: string | null
}): Promise<void> {
  const { error } = await db().from('teacher_service_signups').insert(input)
  if (error) throw error
}

export async function removeSignup(id: string): Promise<void> {
  const { error } = await db().from('teacher_service_signups').delete().eq('id', id)
  if (error) throw error
}
