/**
 * 專心/配合指數（規格書 v3 決議 2；Figma S2/S3）。
 * 以「狀態」而非「成績」語彙呈現（守則紅燈 #1/#7）：
 * 是向家長描述孩子當天的狀態，不是評分，也不做孩子間比較。
 * 幼幼班一律不評指數（點名不顯示指數列、家長端顯示出席勾勾）。
 */
export interface EngagementLevel {
  /** 存入 session_feedback.engagement 的值（4 最投入） */
  value: number
  emoji: string
  label: string
}

/** 依 S2 設計由高到低排列（點名列的顯示順序） */
export const ENGAGEMENT_LEVELS: EngagementLevel[] = [
  { value: 4, emoji: '😍', label: '非常投入' },
  { value: 3, emoji: '🙂', label: '投入' },
  { value: 2, emoji: '😐', label: '普通' },
  { value: 1, emoji: '🥱', label: '需要休息' },
]

export function engagementOf(value: number | null | undefined): EngagementLevel | null {
  if (value == null) return null
  return ENGAGEMENT_LEVELS.find((l) => l.value === value) ?? null
}

/** 該班別是否評指數：幼幼班不評（v3 決議 2） */
export function classHasIndex(className: string | null | undefined): boolean {
  return !!className && !className.includes('幼幼')
}
