/**
 * 專心度/配合度（PRD v2.0／v4 決議 2）。
 * 兩維數值 1–5、下拉預設 5；**僅老師與同工可讀，家長不可見**（RLS 強制）。
 * 幼幼班不評（點名不顯示指數列）。老師端可調閱近三個月走勢與備註。
 * 守則提醒（紅燈 #1/#7）：僅供老師間交接與關懷，不得對孩子或家長作比較/羞辱用途。
 */

/** 下拉選單數值範圍（高 → 低顯示） */
export const SCORE_VALUES = [5, 4, 3, 2, 1]

/** PRD：預設值 5 */
export const SCORE_DEFAULT = 5

export const SCORE_MIN = 1
export const SCORE_MAX = 5

export function isValidScore(v: number | null | undefined): boolean {
  return v != null && Number.isInteger(v) && v >= SCORE_MIN && v <= SCORE_MAX
}

/** 該班別是否評指數：幼幼班不評（依班名判斷，班別未知視為不評） */
export function classHasIndex(className: string | null | undefined): boolean {
  return !!className && !className.includes('幼幼')
}
