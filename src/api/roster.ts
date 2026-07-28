import { db } from '../lib/supabase'
import type { Child } from '../types'

export interface FamilyLink {
  parent_id: string
  child_id: string
}

/** 管理端：全部家長-孩子綁定（RLS：僅 admin 拿得到全部） */
export async function listFamilyLinks(): Promise<FamilyLink[]> {
  const { data, error } = await db().from('family_links').select('*')
  if (error) throw error
  return data as FamilyLink[]
}

export async function createChild(input: {
  name: string
  class_group_id: string
}): Promise<Child> {
  const { data, error } = await db().from('children').insert(input).select().single()
  if (error) throw error
  return data as Child
}

export async function updateChild(
  id: string,
  patch: { name: string; class_group_id: string },
): Promise<void> {
  const { error } = await db().from('children').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChild(id: string): Promise<void> {
  const { error } = await db().from('children').delete().eq('id', id)
  if (error) throw error
}

/** 整組覆寫孩子的家長綁定 */
export async function setChildParents(childId: string, parentIds: string[]): Promise<void> {
  const client = db()
  const { error: delError } = await client.from('family_links').delete().eq('child_id', childId)
  if (delError) throw delError
  if (parentIds.length > 0) {
    const rows = parentIds.map((parent_id) => ({ parent_id, child_id: childId }))
    const { error } = await client.from('family_links').insert(rows)
    if (error) throw error
  }
}
