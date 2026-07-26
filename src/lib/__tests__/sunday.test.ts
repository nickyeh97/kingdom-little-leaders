import { describe, expect, it } from 'vitest'
import { formatSunday, isPlanOpen, lastSunday, planDeadline, upcomingSunday } from '../sunday'

// 基準：2026-07-26 為週日
const SUN = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)

describe('upcomingSunday（下一個主日）', () => {
  it('平日回傳本週日', () => {
    expect(upcomingSunday(SUN(2026, 7, 22))).toBe('2026-07-26') // 週三
    expect(upcomingSunday(SUN(2026, 7, 25))).toBe('2026-07-26') // 週六
  })

  it('邊際：今天就是週日 → 回傳今天', () => {
    expect(upcomingSunday(SUN(2026, 7, 26))).toBe('2026-07-26')
  })

  it('邊際：週一起算下一個週日（跨月）', () => {
    expect(upcomingSunday(SUN(2026, 7, 27))).toBe('2026-08-02')
  })

  it('邊際：跨年', () => {
    expect(upcomingSunday(SUN(2026, 12, 28))).toBe('2027-01-03')
  })

  it('月份與日期補零', () => {
    expect(upcomingSunday(SUN(2026, 8, 3))).toBe('2026-08-09')
  })
})

describe('lastSunday（上一個主日）', () => {
  it('邊際：今天就是週日 → 回傳今天', () => {
    expect(lastSunday(SUN(2026, 7, 26))).toBe('2026-07-26')
  })

  it('週一到週六回傳上個週日', () => {
    expect(lastSunday(SUN(2026, 7, 27))).toBe('2026-07-26') // 週一
    expect(lastSunday(SUN(2026, 8, 1))).toBe('2026-07-26') // 週六（跨月）
  })

  it('邊際：跨年', () => {
    expect(lastSunday(SUN(2027, 1, 2))).toBe('2026-12-27')
  })
})

describe('planDeadline（預先出席截止：主日前的週三 23:59:59）', () => {
  it('落在主日前 4 天且為週三', () => {
    const d = planDeadline('2026-07-26')
    expect(d.getDay()).toBe(3) // 週三
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // 7 月
    expect(d.getDate()).toBe(22)
  })

  it('時間為 23:59:59', () => {
    const d = planDeadline('2026-07-26')
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59])
  })

  it('邊際：主日在月初 → 截止日跨回上個月', () => {
    const d = planDeadline('2026-08-02')
    expect(d.getMonth()).toBe(6) // 7 月
    expect(d.getDate()).toBe(29)
  })

  it('邊際：主日在年初 → 截止日跨回去年', () => {
    const d = planDeadline('2027-01-03')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(30)
  })
})

describe('isPlanOpen（是否仍可填寫）', () => {
  it('截止前可填', () => {
    expect(isPlanOpen('2026-07-26', new Date(2026, 6, 20, 8, 0, 0))).toBe(true)
  })

  it('邊際：剛好在截止時刻（週三 23:59:59）仍可填', () => {
    expect(isPlanOpen('2026-07-26', new Date(2026, 6, 22, 23, 59, 59))).toBe(true)
  })

  it('邊際：截止後一秒即關閉', () => {
    expect(isPlanOpen('2026-07-26', new Date(2026, 6, 23, 0, 0, 0))).toBe(false)
  })

  it('主日當天已關閉', () => {
    expect(isPlanOpen('2026-07-26', new Date(2026, 6, 26, 9, 0, 0))).toBe(false)
  })
})

describe('formatSunday', () => {
  it('格式化為 YYYY/MM/DD（主日）', () => {
    expect(formatSunday('2026-07-26')).toBe('2026/07/26（主日）')
  })
})
