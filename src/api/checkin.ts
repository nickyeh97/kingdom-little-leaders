import { db } from '../lib/supabase'
import type {
  CheckIn,
  CheckInMark,
  CheckInStatus,
  Child,
  ClassGroup,
  PerformanceScore,
  SessionFeedback,
} from '../types'

export async function listClassGroups(): Promise<ClassGroup[]> {
  const { data, error } = await db().from('class_groups').select('*').order('sort_order')
  if (error) throw error
  return data as ClassGroup[]
}

/** 老師端：某班全部孩子（點名底冊） */
export async function listClassChildren(classGroupId: string): Promise<Child[]> {
  const { data, error } = await db()
    .from('children')
    .select('*')
    .eq('class_group_id', classGroupId)
    .order('name')
  if (error) throw error
  return data as Child[]
}

export async function listCheckIns(gatheringDate: string): Promise<CheckIn[]> {
  const { data, error } = await db()
    .from('check_ins')
    .select('*')
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return data as CheckIn[]
}

/** 建立/更新當日紀錄（簽到、臨時請假、老師交接備註） */
export async function upsertCheckIn(entry: {
  child_id: string
  gathering_date: string
  status: CheckInStatus
  note: string | null
  is_walk_in: boolean
}): Promise<void> {
  const { error } = await db()
    .from('check_ins')
    .upsert(entry, { onConflict: 'child_id,gathering_date' })
  if (error) throw error
}

/** 移除當日紀錄（回到「未處理」） */
export async function removeCheckIn(childId: string, gatheringDate: string): Promise<void> {
  const { error } = await db()
    .from('check_ins')
    .delete()
    .eq('child_id', childId)
    .eq('gathering_date', gatheringDate)
  if (error) throw error
}

// ---- 課堂表現回饋（表情，家長可見自己孩子的） ----

export async function listFeedback(gatheringDate: string): Promise<SessionFeedback[]> {
  const { data, error } = await db()
    .from('session_feedback')
    .select('*')
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return data as SessionFeedback[]
}

export async function upsertFeedback(
  childId: string,
  gatheringDate: string,
  moods: string[],
): Promise<void> {
  const { error } = await db()
    .from('session_feedback')
    .upsert(
      { child_id: childId, gathering_date: gatheringDate, moods },
      { onConflict: 'child_id,gathering_date' },
    )
  if (error) throw error
}

// ---- 專心度/配合度（v4 決議 2：僅老師/同工可讀，家長不可見）----

export async function listScores(gatheringDate: string): Promise<PerformanceScore[]> {
  const { data, error } = await db()
    .from('performance_scores')
    .select('*')
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return data as PerformanceScore[]
}

/** 老師點名列：兩維 1–5 即點即存（PRD 預設 5：未設定的另一維以 5 帶入） */
export async function upsertScore(
  childId: string,
  gatheringDate: string,
  focus: number | null,
  cooperation: number | null,
): Promise<void> {
  const { error } = await db()
    .from('performance_scores')
    .upsert(
      { child_id: childId, gathering_date: gatheringDate, focus, cooperation },
      { onConflict: 'child_id,gathering_date' },
    )
  if (error) throw error
}

/** 老師端：單一孩子的近三個月指數走勢 */
export async function listChildScores(
  childId: string,
  from: string,
  to: string,
): Promise<PerformanceScore[]> {
  const { data, error } = await db()
    .from('performance_scores')
    .select('*')
    .eq('child_id', childId)
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date', { ascending: false })
  if (error) throw error
  return data as PerformanceScore[]
}

/** 老師端：單一孩子的近三個月出席/請假紀錄（含老師備註） */
export async function listChildCheckIns(
  childId: string,
  from: string,
  to: string,
): Promise<CheckIn[]> {
  const { data, error } = await db()
    .from('check_ins')
    .select('*')
    .eq('child_id', childId)
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date', { ascending: false })
  if (error) throw error
  return data as CheckIn[]
}

/** 家長端出席勾勾（S3 幼幼班走勢）：僅回傳自己孩子的簽到狀態，不含老師備註 */
export async function listMyCheckinMarks(from: string, to: string): Promise<CheckInMark[]> {
  const { data, error } = await db().rpc('parent_checkin_marks', {
    from_date: from,
    to_date: to,
  })
  if (error) throw error
  return (data ?? []) as CheckInMark[]
}
