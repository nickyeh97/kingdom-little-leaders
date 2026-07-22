import { db } from '../lib/supabase'
import type { CheckIn, Child, ClassGroup } from '../types'

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

export async function listCheckIns(sundayDate: string): Promise<CheckIn[]> {
  const { data, error } = await db()
    .from('check_ins')
    .select('*')
    .eq('sunday_date', sundayDate)
  if (error) throw error
  return data as CheckIn[]
}

export async function checkIn(childId: string, sundayDate: string, isWalkIn: boolean): Promise<void> {
  const { error } = await db()
    .from('check_ins')
    .insert({ child_id: childId, sunday_date: sundayDate, is_walk_in: isWalkIn })
  if (error) throw error
}

export async function undoCheckIn(childId: string, sundayDate: string): Promise<void> {
  const { error } = await db()
    .from('check_ins')
    .delete()
    .eq('child_id', childId)
    .eq('sunday_date', sundayDate)
  if (error) throw error
}
