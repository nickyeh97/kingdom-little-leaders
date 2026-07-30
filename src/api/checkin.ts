import { db } from '../lib/supabase'
import type {
  CheckIn,
  CheckInMark,
  CheckInStatus,
  Child,
  ClassGroup,
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

/** 老師點名列：標記/取消專心配合指數（null＝取消；moods 維持不動） */
export async function setEngagement(
  childId: string,
  gatheringDate: string,
  engagement: number | null,
): Promise<void> {
  const { error } = await db()
    .from('session_feedback')
    .upsert(
      { child_id: childId, gathering_date: gatheringDate, engagement },
      { onConflict: 'child_id,gathering_date' },
    )
  if (error) throw error
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
