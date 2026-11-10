/**
 * 聚會日與預先出席截止時間的計算工具。
 * 聚會日不寫死週幾（見 config.ts），全部使用瀏覽器本地時區（台灣使用情境）。
 */
import {
  FEEDBACK_DUE_DAYS,
  GATHERING_OVERRIDES,
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

type Overrides = Readonly<Record<string, string>>

/** 未套改期的「固定週幾」下一個聚會日（今天即聚會日 → 今天） */
function regularUpcoming(from: Date, weekday: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return d
}

/**
 * 以 base 為起點、每 7 天一次、共 n 次的固定聚會日，套上單次改期（GATHERING_OVERRIDES）後排序。
 * 改期只會挪動幾天，呼叫端多抓前後一週即可涵蓋。
 */
function actualSeries(base: Date, n: number, overrides: Overrides): string[] {
  const d = new Date(base)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const r = toDateString(d)
    out.push(overrides[r] ?? r)
    d.setDate(d.getDate() + 7)
  }
  return out.sort()
}

/** 下一個聚會日（若今天就是聚會日，回傳今天）— 供點名、出席勾選共用 */
export function upcomingGathering(
  from = new Date(),
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): string {
  return upcomingGatherings(1, from, weekday, overrides)[0]
}

/** 上一個聚會日（若今天就是聚會日，回傳今天）— 供家長端查看課堂回饋 */
export function lastGathering(
  from = new Date(),
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): string {
  return recentGatherings(1, from, weekday, overrides)[0]
}

/** 該日（YYYY-MM-DD）是否為聚會日（含單次改期：改走的原日期不算、改到的日期算） */
export function isGatheringDate(
  date: string,
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): boolean {
  if (Object.values(overrides).includes(date)) return true
  if (date in overrides) return false
  return new Date(`${date}T00:00:00`).getDay() === weekday
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

/** 本次聚會日之後的下一次聚會日 — 供歌單「下週＊＊班」標籤 */
export function nextGathering(
  from = new Date(),
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): string {
  return upcomingGatherings(2, from, weekday, overrides)[1]
}

/** 未來 N 次聚會日（含本週，新 → 更未來）— 供服事報名/排班的日期清單 */
export function upcomingGatherings(
  count: number,
  from = new Date(),
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): string[] {
  const today = toDateString(from)
  const base = regularUpcoming(from, weekday)
  base.setDate(base.getDate() - 7) // 上週原定日可能被改到今天之後
  return actualSeries(base, count + 2, overrides)
    .filter((d) => d >= today)
    .slice(0, count)
}

/** 近 N 次聚會日（舊 → 新，最後一筆＝最近一次聚會）— 供家長端近三週走勢 */
export function recentGatherings(
  count: number,
  from = new Date(),
  weekday = GATHERING_WEEKDAY,
  overrides: Overrides = GATHERING_OVERRIDES,
): string[] {
  const today = toDateString(from)
  const base = regularUpcoming(from, weekday)
  base.setDate(base.getDate() - 7 * count) // 往前 count 週，再往後多抓一週（可能被改到今天以前）
  return actualSeries(base, count + 2, overrides)
    .filter((d) => d <= today)
    .slice(-count)
}

/** 「M/D」短日期（走勢軸標籤用） */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

/**
 * 日期後綴用「聚會日」而不是「主日」（v15）：本教會聚會在**週六下午**，
 * 寫「主日」會被讀成星期日，實際造成過誤會。
 */
export function formatGathering(gatheringDate: string): string {
  const [y, m, d] = gatheringDate.split('-')
  return `${y}/${m}/${d}（聚會日）`
}

/** 「週X」中文字，供截止提示等文案使用 */
export function weekdayName(d: Date): string {
  return `週${WEEKDAY_NAMES[d.getDay()]}`
}
