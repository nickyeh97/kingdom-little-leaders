/**
 * 詩歌兩維熟悉度（規格書 v3 決議 5）。
 * 「歌曲熟悉度」與「動作熟悉度」是**班級整體**的練習進度（班別 × 歌曲），
 * 不評比個別孩子（守則紅燈 #1）；幼幼班老師不需填寫。
 * 於課堂紀錄（日誌）流程填寫，詩歌頁同步顯示。
 */
export interface FamiliarityLevel {
  value: number
  label: string
}

export const FAMILIARITY_LEVELS: FamiliarityLevel[] = [
  { value: 1, label: '陌生' },
  { value: 2, label: '練習中' },
  { value: 3, label: '熟悉' },
]

export function familiarityLabel(value: number | null | undefined): string | null {
  if (value == null) return null
  return FAMILIARITY_LEVELS.find((l) => l.value === value)?.label ?? null
}
