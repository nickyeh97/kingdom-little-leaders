/**
 * 聚會日與預先出席截止時間的計算工具。
 * 聚會日不寫死週幾（見 config.ts），全部使用瀏覽器本地時區（台灣使用情境）。
 */
import {
  FEEDBACK_DUE_DAYS,
  GATHERING_WEEKDAY,
  PLAN_DEADLINE_DAYS_BEFORE,
  RECORDS_MONTHS,
  WEEKDAY_NAMES,
} from './config'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 下一個聚會日（若今天就是聚會日，回傳今天）— 供點名、出席勾選共用 */
export function upcomingGathering(from = new Date(), weekday = GATHERING_WEEKDAY): string {
  const d = new Date(from)
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return toDateString(d)
}

/** 上一個聚會日（若今天就是聚會日，回傳今天）— 供家長端查看課堂回饋 */
export function lastGathering(from = new Date(), weekday = GATHERING_WEEKDAY): string {
  const d = new Date(from)
  d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7))
  return toDateString(d)
}

/** 該聚會日的填寫截止時間：聚會日前 N 天的 23:59:59 */
export function planDeadline(
  gatheringDate: string,
  daysBefore = PLAN_DEADLINE_DAYS_BEFORE,
): Date {
  const d = new Date(`${gatheringDate}T23:59:59`)
  d.setDate(d.getDate() - daysBefore)
  return d
}

/** 預先出席是否仍開放填寫 */
export function isPlanOpen(gatheringDate: string, now = new Date()): boolean {
  return now <= planDeadline(gatheringDate)
}

/** 課後反饋截止時間：聚會日後 N 天的 23:59:59 */
export function feedbackDeadline(gatheringDate: string, dueDays = FEEDBACK_DUE_DAYS): Date {
  const d = new Date(`${gatheringDate}T23:59:59`)
  d.setDate(d.getDate() + dueDays)
  return d
}

/** 課後反饋是否仍在填寫期限內 */
export function isFeedbackOpen(gatheringDate: string, now = new Date()): boolean {
  return now <= feedbackDeadline(gatheringDate)
}

/** 出席紀錄查詢起點：N 個月前的今天（YYYY-MM-DD） */
export function recordsRangeStart(from = new Date(), months = RECORDS_MONTHS): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() - months)
  return toDateString(d)
}

export function formatGathering(gatheringDate: string): string {
  const [y, m, d] = gatheringDate.split('-')
  return `${y}/${m}/${d}（主日）`
}

/** 「週X」中文字，供截止提示等文案使用 */
export function weekdayName(d: Date): string {
  return `週${WEEKDAY_NAMES[d.getDay()]}`
}
