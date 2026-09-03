/**
 * 課堂紀錄的兩維指數（v11 #5）：流程順暢度、學生配合度。
 *
 * 這兩維評的是**這堂課的運作**（流程順不順、班級整體配不配合），
 * 不是任何一個孩子——不得用來比較孩子或班級（`docs/DESIGN_PRINCIPLES.md` 紅燈 #1／#7）。
 * 原本點名頁的「專心度/配合度」（逐個孩子）已自介面移除，資料保留待組長裁決。
 *
 * 未填＝null（不預設帶值，避免「沒想過」被記成 5 分）。
 */

export const LOG_SCORE_VALUES = [1, 2, 3, 4, 5]
export const LOG_SCORE_MIN_LABEL = '不順'
export const LOG_SCORE_MAX_LABEL = '順暢'

export type LogScoreDim = 'flow_score' | 'cooperation_score'

export const LOG_SCORE_LABELS: Record<LogScoreDim, string> = {
  flow_score: '流程順暢度',
  cooperation_score: '學生配合度',
}

export function isValidLogScore(v: number | null | undefined): boolean {
  return v != null && Number.isInteger(v) && v >= 1 && v <= 5
}

/** 顯示用：未填回 null，呼叫端據此不顯示該維 */
export function logScoreText(dim: LogScoreDim, v: number | null | undefined): string | null {
  return isValidLogScore(v) ? `${LOG_SCORE_LABELS[dim]} ${v}` : null
}
