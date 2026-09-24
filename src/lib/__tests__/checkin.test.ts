import { describe, expect, it } from 'vitest'
import { checkInDates, isCheckInEditable, planLabel, planStats } from '../checkin'
import type { AttendancePlan } from '../../types'

// 2026-09-24 是週四；聚會日週六
const thu = new Date(2026, 8, 24)

describe('checkInDates', () => {
  it('本週起 12 次，不含過去', () => {
    const dates = checkInDates(thu)
    expect(dates).toHaveLength(12)
    expect(dates[0]).toBe('2026-09-26')
    expect(dates[11]).toBe('2026-12-12')
  })

  it('聚會日當天：第一筆就是今天', () => {
    expect(checkInDates(new Date(2026, 8, 26))[0]).toBe('2026-09-26')
  })
})

describe('isCheckInEditable', () => {
  it('本週聚會日可以簽到（週間先看、當天再點都算本週）', () => {
    expect(isCheckInEditable('2026-09-26', thu)).toBe(true)
    expect(isCheckInEditable('2026-09-26', new Date(2026, 8, 26, 14, 30))).toBe(true)
  })
  it('之後的週只能預覽', () => {
    expect(isCheckInEditable('2026-10-03', thu)).toBe(false)
  })
  it('聚會日過了就換下一週', () => {
    expect(isCheckInEditable('2026-09-26', new Date(2026, 8, 27))).toBe(false)
    expect(isCheckInEditable('2026-10-03', new Date(2026, 8, 27))).toBe(true)
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
