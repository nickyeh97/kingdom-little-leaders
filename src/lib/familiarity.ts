/**
 * 詩歌兩維熟悉度（PRD v2.0／v4 決議 3）。
 * 「歌曲熟悉度」與「動作熟練度」記錄於詩歌曲目上（班別 × 歌曲），
 * 數值 1–5：1＝不熟、5＝熟悉。是班級整體的練習進度，不評比個別孩子（守則紅燈 #1）。
 * 老師可於詩歌頁直接編輯，也可於課堂紀錄（日誌）流程覆寫；幼幼班老師不需填寫。
 */
export const FAMILIARITY_VALUES = [1, 2, 3, 4, 5]

export const FAMILIARITY_MIN_LABEL = '不熟'
export const FAMILIARITY_MAX_LABEL = '熟悉'

/** 顯示文字：如「4/5」；未填回傳 null */
export function familiarityText(value: number | null | undefined): string | null {
  if (value == null || value < 1 || value > 5) return null
  return `${value}/5`
}
