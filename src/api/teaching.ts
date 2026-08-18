import { db } from '../lib/supabase'
import type { ClassDoc, LessonSegment, Material } from '../types'

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

export async function createLessonSegment(input: LessonSegmentInput): Promise<void> {
  const { error } = await db().from('lesson_segments').insert(input)
  if (error) throw error
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
