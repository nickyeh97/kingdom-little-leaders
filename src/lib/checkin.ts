/**
 * 點名頁的日期切換（v18）。
 *
 * 老師備課時要先估那一週大概幾個孩子會來，也要知道哪些家長還沒填（好去提醒），
 * 所以點名頁比照教案頁開放切換日期：近 3 次＋未來 12 次聚會日。
 * 未來的日期只能「看」家長預填，簽到要等到當天。
 */
import { recentGatherings, upcomingGatherings } from './gathering'
import type { AttendancePlan } from '../types'

/** 點名頁可切換的聚會日（舊 → 新），與教案頁相同範圍 */
export function checkInDates(from = new Date()): string[] {
  return [...new Set([...recentGatherings(3, from), ...upcomingGatherings(12, from)])]
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 這一天能不能簽到：當天或已經過去的聚會日可以（過去＝補點名），未來只能預覽。
 * 用字串比較就夠——兩邊都是 YYYY-MM-DD。
 */
export function isCheckInEditable(gatheringDate: string, today = new Date()): boolean {
  return gatheringDate <= toDateString(today)
}

/**
 * 卡片上的家長預填說明。
 * 「未定」與「還沒填」分開講：要提醒家長的是這兩種，但話術不一樣——
 * 一個是勾了未定要追問，一個是根本還沒進來填。
 */
export function planLabel(plan: AttendancePlan | undefined): string {
  if (!plan) return '家長尚未填寫'
  if (plan.status === 'attending') return '家長已預先勾選出席'
  if (plan.status === 'leave') return '家長已請假'
  return '家長勾了未定'
}

export interface PlanStats {
  attending: number
  leave: number
  /** 未定＋尚未填寫——畫面上叫「待確認」，都是要提醒家長的對象 */
  pending: number
}

/** 某班在某聚會日的預填統計 */
export function planStats(plans: Map<string, AttendancePlan>, childIds: string[]): PlanStats {
  let attending = 0
  let leave = 0
  for (const id of childIds) {
    const s = plans.get(id)?.status
    if (s === 'attending') attending++
    else if (s === 'leave') leave++
  }
  return { attending, leave, pending: childIds.length - attending - leave }
}
