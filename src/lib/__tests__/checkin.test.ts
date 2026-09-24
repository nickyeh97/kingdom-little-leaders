import { describe, expect, it } from 'vitest'
import { checkInDates, isCheckInEditable, planLabel, planStats } from '../checkin'
import type { AttendancePlan } from '../../types'

// 2026-09-24 是週四；聚會日週六
const thu = new Date(2026, 8, 24)

describe('checkInDates', () => {
  it('近 3 次＋未來 12 次，舊到新、不重複', () => {
    const dates = checkInDates(thu)
    expect(dates).toHaveLength(15)
    expect(dates[0]).toBe('2026-09-05')
    expect(dates[2]).toBe('2026-09-19')
    expect(dates[3]).toBe('2026-09-26')
    expect(dates[14]).toBe('2026-12-12')
    expect(new Set(dates).size).toBe(15)
  })

  it('聚會日當天：recent 與 upcoming 都含今天，只留一筆', () => {
    const sat = new Date(2026, 8, 26)
    const dates = checkInDates(sat)
    expect(dates.filter((d) => d === '2026-09-26')).toHaveLength(1)
    expect(dates).toHaveLength(14)
  })
})

describe('isCheckInEditable', () => {
  it('當天可以簽到', () => {
    expect(isCheckInEditable('2026-09-26', new Date(2026, 8, 26, 14, 30))).toBe(true)
  })
  it('過去的聚會日可以補點名', () => {
    expect(isCheckInEditable('2026-09-19', thu)).toBe(true)
  })
  it('未來只能預覽', () => {
    expect(isCheckInEditable('2026-09-26', thu)).toBe(false)
    expect(isCheckInEditable('2026-10-03', thu)).toBe(false)
  })
})

const plan = (child_id: string, status: AttendancePlan['status']): AttendancePlan => ({
  id: child_id,
  child_id,
  gathering_date: '2026-10-03',
  status,
  note: null,
  updated_by: 'p',
})

describe('planLabel', () => {
  it('四種狀態各自有話', () => {
    expect(planLabel(undefined)).toBe('家長尚未填寫')
    expect(planLabel(plan('a', 'attending'))).toBe('家長已預先勾選出席')
    expect(planLabel(plan('a', 'leave'))).toBe('家長已請假')
    expect(planLabel(plan('a', 'undecided'))).toBe('家長勾了未定')
  })
})

describe('planStats', () => {
  it('未定與未填都算 pending', () => {
    const plans = new Map<string, AttendancePlan>([
      ['a', plan('a', 'attending')],
      ['b', plan('b', 'attending')],
      ['c', plan('c', 'leave')],
      ['d', plan('d', 'undecided')],
    ])
    expect(planStats(plans, ['a', 'b', 'c', 'd', 'e'])).toEqual({ attending: 2, leave: 1, pending: 2 })
  })

  it('只算傳入的孩子（他班的預填不計）', () => {
    const plans = new Map<string, AttendancePlan>([['z', plan('z', 'attending')]])
    expect(planStats(plans, ['a'])).toEqual({ attending: 0, leave: 0, pending: 1 })
  })
})
