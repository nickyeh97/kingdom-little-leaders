import { describe, expect, it } from 'vitest'
import {
  formatGathering,
  isPlanOpen,
  lastGathering,
  planDeadline,
  upcomingGathering,
  weekdayName,
} from '../gathering'
import { GATHERING_WEEKDAY } from '../config'

// 基準：2026-07-25 為週六（目前的聚會日）、2026-07-26 為週日
const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)

describe('設定檢核', () => {
  it('目前聚會日設定為週六（教會實際情況）', () => {
    expect(GATHERING_WEEKDAY).toBe(6)
  })
})

describe('upcomingGathering（下一個聚會日，預設週六）', () => {
  it('平日回傳本週六', () => {
    expect(upcomingGathering(D(2026, 7, 22))).toBe('2026-07-25') // 週三
    expect(upcomingGathering(D(2026, 7, 24))).toBe('2026-07-25') // 週五
  })

  it('邊際：今天就是聚會日 → 回傳今天', () => {
    expect(upcomingGathering(D(2026, 7, 25))).toBe('2026-07-25')
  })

  it('邊際：聚會日隔天（週日）起算下一週（跨月）', () => {
    expect(upcomingGathering(D(2026, 7, 26))).toBe('2026-08-01')
  })

  it('邊際：跨年', () => {
    expect(upcomingGathering(D(2026, 12, 28))).toBe('2027-01-02')
  })

  it('聚會日不強制週幾：改傳週日也能正確計算', () => {
    expect(upcomingGathering(D(2026, 7, 22), 0)).toBe('2026-07-26')
    expect(upcomingGathering(D(2026, 7, 26), 0)).toBe('2026-07-26')
  })
})

describe('lastGathering（上一個聚會日）', () => {
  it('邊際：今天就是聚會日 → 回傳今天', () => {
    expect(lastGathering(D(2026, 7, 25))).toBe('2026-07-25')
  })

  it('聚會日之後的平日回傳上個週六', () => {
    expect(lastGathering(D(2026, 7, 26))).toBe('2026-07-25') // 週日
    expect(lastGathering(D(2026, 7, 29))).toBe('2026-07-25') // 週三
  })

  it('邊際：跨月與跨年', () => {
    expect(lastGathering(D(2026, 8, 2))).toBe('2026-08-01')
    expect(lastGathering(D(2027, 1, 1))).toBe('2026-12-26') // 週五 → 上個週六
  })

  it('聚會日不強制週幾：改傳週日也能正確計算', () => {
    expect(lastGathering(D(2026, 7, 27), 0)).toBe('2026-07-26')
  })
})

describe('planDeadline（截止：聚會日前 3 天 23:59:59，週六聚會 → 週三截止）', () => {
  it('落在聚會日前 3 天且為週三', () => {
    const d = planDeadline('2026-07-25')
    expect(d.getDay()).toBe(3)
    expect([d.getMonth(), d.getDate()]).toEqual([6, 22])
  })

  it('時間為 23:59:59', () => {
    const d = planDeadline('2026-07-25')
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59])
  })

  it('邊際：聚會日在月初 → 截止日跨回上個月', () => {
    const d = planDeadline('2026-08-01')
    expect([d.getMonth(), d.getDate()]).toEqual([6, 29])
  })

  it('邊際：聚會日在年初 → 截止日跨回去年', () => {
    const d = planDeadline('2027-01-02')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 30])
  })

  it('截止提前天數可設定', () => {
    const d = planDeadline('2026-07-25', 1)
    expect([d.getMonth(), d.getDate()]).toEqual([6, 24]) // 前一天（週五）
  })
})

describe('isPlanOpen（是否仍可填寫）', () => {
  it('截止前可填', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 20, 8, 0, 0))).toBe(true)
  })

  it('邊際：剛好在截止時刻（週三 23:59:59）仍可填', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 22, 23, 59, 59))).toBe(true)
  })

  it('邊際：截止後一秒即關閉', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 23, 0, 0, 0))).toBe(false)
  })

  it('聚會日當天已關閉', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 25, 9, 0, 0))).toBe(false)
  })
})

describe('顯示文字', () => {
  it('formatGathering 格式化為 YYYY/MM/DD（主日）', () => {
    expect(formatGathering('2026-07-25')).toBe('2026/07/25（主日）')
  })

  it('weekdayName 回傳中文週名', () => {
    expect(weekdayName(D(2026, 7, 22))).toBe('週三')
    expect(weekdayName(D(2026, 7, 25))).toBe('週六')
    expect(weekdayName(D(2026, 7, 26))).toBe('週日')
  })
})
