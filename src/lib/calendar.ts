/**
 * 出席行事曆的月曆格工具（規格書 v3 決議 1：出席頁改為行事曆呈現）。
 * 週從週日起排（台灣月曆慣例）；聚會日由 config 決定，不寫死週幾。
 */
import { GATHERING_WEEKDAY } from './config'

export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string
  /** 當月日數（1–31） */
  day: number
  /** 是否屬於錨點月份（補位的前後月為 false） */
  inMonth: boolean
  /** 是否為聚會日 */
  isGathering: boolean
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 取日期（YYYY-MM-DD）所屬月份錨點（YYYY-MM） */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** 月份錨點（YYYY-MM）位移 delta 個月（可跨年） */
export function addMonths(anchor: string, delta: number): string {
  const [y, m] = anchor.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthOf(toDateString(d))
}

export function monthTitle(anchor: string): string {
  const [y, m] = anchor.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

/** 該月月初與月底（供撈整月出席資料） */
export function monthRange(anchor: string): { from: string; to: string } {
  const [y, m] = anchor.split('-').map(Number)
  return { from: toDateString(new Date(y, m - 1, 1)), to: toDateString(new Date(y, m, 0)) }
}

/** 該月的月曆格：含前後月補位、對齊週日起的完整週（長度為 7 的倍數） */
export function monthGrid(anchor: string, weekday = GATHERING_WEEKDAY): CalendarCell[] {
  const [y, m] = anchor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const end = new Date(last)
  end.setDate(last.getDate() + (6 - last.getDay()))

  const cells: CalendarCell[] = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    cells.push({
      date: toDateString(d),
      day: d.getDate(),
      inMonth: d.getMonth() === m - 1,
      isGathering: d.getDay() === weekday,
    })
  }
  return cells
}
