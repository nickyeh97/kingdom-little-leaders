import { db } from '../lib/supabase'
import type { ClassDoc, LessonSegment, Material, ParentLessonSegment } from '../types'

// ---- 教案（分區塊共編：以「列」為單位各自儲存）----

export async function listLessonSegments(
  classGroupId: string,
  gatheringDate: string,
): Promise<LessonSegment[]> {
  const { data, error } = await db()
    .from('lesson_segments')
    .select('*')
    .eq('class_group_id', classGroupId)
    .eq('gathering_date', gatheringDate)
    .order('sort_order')
  if (error) throw error
  return data as LessonSegment[]
}

/** 區間內某班的所有教案段落（匯出近一季用；依日期、順序排序） */
export async function listLessonSegmentsRange(
  classGroupId: string,
  from: string,
  to: string,
): Promise<LessonSegment[]> {
  const { data, error } = await db()
    .from('lesson_segments')
    .select('*')
    .eq('class_group_id', classGroupId)
    .gte('gathering_date', from)
    .lte('gathering_date', to)
    .order('gathering_date')
    .order('sort_order')
  if (error) throw error
  return data as LessonSegment[]
}

/** 該日期各班教案列數（首頁同工通知／頁面徽章用） */
export async function listLessonSegmentsByDate(gatheringDate: string): Promise<LessonSegment[]> {
  const { data, error } = await db()
    .from('lesson_segments')
    .select('*')
    .eq('gathering_date', gatheringDate)
  if (error) throw error
  return data as LessonSegment[]
}

export interface LessonSegmentInput {
  class_group_id: string
  gathering_date: string
  time_text: string
  item: string
  content: string
  teacher_text: string
  materials_text: string
  review_text: string
  sort_order: number
  updated_by_name: string
}

export async function createLessonSegment(input: LessonSegmentInput): Promise<LessonSegment> {
  const { data, error } = await db().from('lesson_segments').insert(input).select().single()
  if (error) throw error
  return data as LessonSegment
}

export async function updateLessonSegment(
  id: string,
  patch: Partial<LessonSegmentInput>,
): Promise<void> {
  const { error } = await db().from('lesson_segments').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLessonSegment(id: string): Promise<void> {
  const { error } = await db().from('lesson_segments').delete().eq('id', id)
  if (error) throw error
}

/**
 * 家長版簡易教案（v10 #2）：走 parent_lesson_segments() RPC。
 * RPC 已在資料庫層限定「自己孩子的班別 × 已上過的日期 × 非幼幼班」，
 * 且只回項目/內容/帶班老師——前端不需要、也拿不到教材預備與課後執行。
 */
export async function listParentLessonSegments(
  from: string,
  to: string,
): Promise<ParentLessonSegment[]> {
  const { data, error } = await db().rpc('parent_lesson_segments', {
    from_date: from,
    to_date: to,
  })
  if (error) throw error
  return (data ?? []) as ParentLessonSegment[]
}

// ---- 聚會流程／運作要點（每班一份，同工維護）----

export async function listClassDocs(classGroupId: string): Promise<ClassDoc[]> {
  const { data, error } = await db()
    .from('class_docs')
    .select('*')
    .eq('class_group_id', classGroupId)
    .order('sort_order')
  if (error) throw error
  return data as ClassDoc[]
}

export interface ClassDocInput {
  class_group_id: string
  kind: 'flow' | 'guide'
  title: string
  content: string
  extra: string
  minutes?: number | null
  sort_order: number
}

export async function createClassDoc(input: ClassDocInput): Promise<void> {
  const { error } = await db().from('class_docs').insert(input)
  if (error) throw error
}

export async function updateClassDoc(id: string, patch: Partial<ClassDocInput>): Promise<void> {
  const { error } = await db().from('class_docs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteClassDoc(id: string): Promise<void> {
  const { error } = await db().from('class_docs').delete().eq('id', id)
  if (error) throw error
}

// ---- 教材資料庫（外連型）----

export async function listMaterials(): Promise<Material[]> {
  const { data, error } = await db()
    .from('materials')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Material[]
}

export interface MaterialInput {
  class_group_id: string | null
  category: string
  title: string
  url: string
  note: string
  created_by_name: string
}

export async function createMaterial(input: MaterialInput): Promise<void> {
  const { error } = await db().from('materials').insert(input)
  if (error) throw error
}

export async function updateMaterial(id: string, patch: Partial<MaterialInput>): Promise<void> {
  const { error } = await db().from('materials').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await db().from('materials').delete().eq('id', id)
  if (error) throw error
}
