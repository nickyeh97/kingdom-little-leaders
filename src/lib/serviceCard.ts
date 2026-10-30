/**
 * 服事經歷卡（小領袖靈獸）的計算規則——與遊戲 repo 的 Core（GrowthRules／ServiceCard）同一套，
 * 測試案例也對齊（GDD §8.3）。等級、階段是派生值，不存資料庫。
 *
 *   等級＝該項目次數＋1（還沒服事過是一等，第一次服事升二等）
 *   階段＝總次數跨過的門檻數（0／4／12／24 → 初生／成長／茁壯／小領袖），永不退階
 *
 * 守則：只呈現孩子自己的軌跡；不顯示「還差幾次進化」（組長裁決 2026-09-17，進化是驚喜不是倒數）。
 */
import type { ChildServiceItem, ServiceCardEntry } from '../types'

export const STAGE_THRESHOLDS = [0, 4, 12, 24] as const
export const STAGE_NAMES = ['初生', '成長', '茁壯', '小領袖'] as const

/** 鼓勵的話：最多 5 句、每句 1–40 字（與資料庫 valid_encouragements 一致） */
export const MAX_ENCOURAGEMENTS = 5
export const MAX_ENCOURAGEMENT_LENGTH = 40

export function level(count: number): number {
  return Math.max(0, count) + 1
}

export function stage(total: number): number {
  let s = 1
  STAGE_THRESHOLDS.forEach((t, i) => {
    if (total >= t) s = i + 1
  })
  return s
}

export function stageName(total: number): string {
  return STAGE_NAMES[stage(total) - 1]
}

export interface ServiceCardRow {
  item: string
  count: number
  level: number
  /** 字典已停用（或改名）但有舊紀錄的項目：照樣列出、照樣計數 */
  retired: boolean
}

/**
 * 服事卡的每一列：啟用中的項目依字典順序，後面接「已停用但有紀錄」的項目。
 * 已停用又沒有紀錄的項目不顯示。
 */
export function serviceCardRows(
  items: Pick<ChildServiceItem, 'name' | 'sort_order' | 'active'>[],
  entries: Pick<ServiceCardEntry, 'item'>[],
): ServiceCardRow[] {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.item, (counts.get(e.item) ?? 0) + 1)
  const active = [...items]
    .filter((i) => i.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-TW'))
    .map((i) => i.name)
  const rows = active.map((name) => {
    const count = counts.get(name) ?? 0
    return { item: name, count, level: level(count), retired: false }
  })
  for (const [name, count] of counts) {
    if (!active.includes(name)) rows.push({ item: name, count, level: level(count), retired: true })
  }
  return rows
}

/**
 * 整理家長輸入的鼓勵話：每行一句，去掉前後空白與空行。
 * 回傳整理後的句子，或第一個問題（給 toast 用）。
 */
export function parseEncouragements(text: string): { words: string[]; error: string | null } {
  const words = text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (words.length > MAX_ENCOURAGEMENTS) {
    return { words, error: `最多 ${MAX_ENCOURAGEMENTS} 句（目前 ${words.length} 句）` }
  }
  const tooLong = words.findIndex((w) => [...w].length > MAX_ENCOURAGEMENT_LENGTH)
  if (tooLong >= 0) {
    return { words, error: `第 ${tooLong + 1} 句超過 ${MAX_ENCOURAGEMENT_LENGTH} 字` }
  }
  return { words, error: null }
}

/** 紀錄日期（台灣時間）：2026/10/25 */
export function entryDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`
}
