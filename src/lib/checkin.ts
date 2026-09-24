/**
 * 點名頁的日期切換（v18）。
 *
 * 老師備課時要先估那一週大概幾個孩子會來，也要知道哪些家長還沒填（好去提醒），
 * 所以點名頁開放切換日期：本週＋未來 11 次聚會日（共 12 次）。
 * 只有本週能簽到，其他週只能「看」家長預填。
 * 不含過去的聚會日：暫時不做補簽，而且過去的簽到結果和未來的預填擺在同一列容易混淆（組長裁決）。
 */
import { upcomingGathering, upcomingGatherings } from './gathering'
import type { AttendancePlan } from '../types'

/** 點名頁可切換的聚會日（本週 → 更未來） */
export function checkInDates(from = new Date()): string[] {
  return upcomingGatherings(12, from)
}

/** 只有本週（下一次）聚會日能簽到——與改版前的點名頁行為相同；其他週只能預覽 */
export function isCheckInEditable(gatheringDate: string, from = new Date()): boolean {
  return gatheringDate === upcomingGathering(from)
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
