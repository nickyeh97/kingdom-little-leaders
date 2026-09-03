import { db } from '../lib/supabase'
import type {
  AttendancePlan,
  CheckIn,
  Child,
  PerformanceScore,
  SessionFeedback,
  SessionLog,
} from '../types'

/** 老師/同工：全部孩子（供紀錄查詢對照班別與姓名） */
export async function listAllChildren(): Promise<Child[]> {
  const { data, error } = await db()
    .from('children')
    .select('*, class_groups(*)')
    .order('name')
  if (error) throw error
  return data as Child[]
}

export async function listPlansRange(from: string, to: string): Promise<AttendancePlan[]> {
  const { data, error } = await db()
    .from('attendance_plans')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
  if (error) throw error
  return data as AttendancePlan[]
}

export async function listCheckInsRange(from: string, to: string): Promise<CheckIn[]> {
  const { data, error } = await db()
    .from('check_ins')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
  if (error) throw error
  return data as CheckIn[]
}

export async function listFeedbackRange(from: string, to: string): Promise<SessionFeedback[]> {
  const { data, error } = await db()
    .from('session_feedback')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
  if (error) throw error
  return data as SessionFeedback[]
}

/** 專心度/配合度（僅老師/同工可讀，RLS 強制）—— 紀錄頁與 CSV 匯出用 */
export async function listScoresRange(from: string, to: string): Promise<PerformanceScore[]> {
  const { data, error } = await db()
    .from('performance_scores')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
  if (error) throw error
  return data as PerformanceScore[]
}

export async function listSessionLogsRange(from: string, to: string): Promise<SessionLog[]> {
  const { data, error } = await db()
    .from('session_logs')
    .select('*')
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date', { ascending: false })
  if (error) throw error
  return data as SessionLog[]
}

/** 老師：建立/更新某班某聚會日的課堂紀錄 */
export async function upsertSessionLog(entry: {
  class_group_id: string
  gathering_date: string
  teacher_name: string
  content: string
  song_progress: string
  feedback: string
  flow_score: number | null
  cooperation_score: number | null
}): Promise<void> {
  const { error } = await db()
    .from('session_logs')
    .upsert(entry, { onConflict: 'class_group_id,gathering_date' })
  if (error) throw error
}
