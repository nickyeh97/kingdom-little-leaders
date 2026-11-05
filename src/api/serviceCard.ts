import { db } from '../lib/supabase'
import type { BeastProfile, ServiceCardEntry } from '../types'

// ---- 服事經歷卡（小領袖靈獸）----
// 權限全在 RLS（migration 2026-10-02_service_card）：家長只讀得到自己孩子的、只刪得掉自己登錄的。

/** 孩子的服事紀錄，新的在前 */
export async function listServiceCardEntries(childId: string): Promise<ServiceCardEntry[]> {
  const { data, error } = await db()
    .from('service_card_entries')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ServiceCardEntry[]
}

/** 刪掉一筆誤登（RLS：家長限自己登錄的） */
export async function deleteServiceCardEntry(id: string): Promise<void> {
  const { error } = await db().from('service_card_entries').delete().eq('id', id)
  if (error) throw error
}

/** 靈獸設定；孩子還沒在遊戲裡選靈獸時回 null */
export async function getBeastProfile(childId: string): Promise<BeastProfile | null> {
  const { data, error } = await db()
    .from('beast_profiles')
    .select('child_id, variant, palette, encouragements')
    .eq('child_id', childId)
    .maybeSingle()
  if (error) throw error
  return data as BeastProfile | null
}

/** 存鼓勵的話（只改這一欄，外觀不動） */
export async function saveEncouragements(childId: string, words: string[]): Promise<void> {
  const { error } = await db()
    .from('beast_profiles')
    .update({ encouragements: words })
    .eq('child_id', childId)
  if (error) throw error
}
