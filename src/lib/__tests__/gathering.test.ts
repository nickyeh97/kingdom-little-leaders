import { describe, expect, it } from 'vitest'
import {
  feedbackDeadline,
  formatGathering,
  isFeedbackOpen,
  isPlanOpen,
  lastGathering,
  planDeadline,
  recordsRangeStart,
  upcomingGathering,
  weekdayName,
  nextGathering,
  recentGatherings,
  upcomingGatherings,
  shortDate,
  isGatheringDate,
} from '../gathering'
import { GATHERING_WEEKDAY, PLAN_DEADLINE_DAYS_BEFORE } from '../config'

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

describe('planDeadline（截止：聚會日前 N 天 23:59:59，N 由 config 設定）', () => {
  it('預設跟隨 config 設定值（目前：前 1 天）', () => {
    const d = planDeadline('2026-07-25')
    const expected = new Date(2026, 6, 25)
    expected.setDate(expected.getDate() - PLAN_DEADLINE_DAYS_BEFORE)
    expect([d.getMonth(), d.getDate()]).toEqual([expected.getMonth(), expected.getDate()])
  })

  it('時間為 23:59:59', () => {
    const d = planDeadline('2026-07-25')
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59])
  })

  it('截止提前天數可設定：前 1 天（週五）／前 3 天（週三）', () => {
    const fri = planDeadline('2026-07-25', 1)
    expect([fri.getDay(), fri.getMonth(), fri.getDate()]).toEqual([5, 6, 24])
    const wed = planDeadline('2026-07-25', 3)
    expect([wed.getDay(), wed.getMonth(), wed.getDate()]).toEqual([3, 6, 22])
  })

  it('邊際：聚會日在月初 → 截止日跨回上個月', () => {
    const d = planDeadline('2026-08-01', 3)
    expect([d.getMonth(), d.getDate()]).toEqual([6, 29])
  })

  it('邊際：聚會日在年初 → 截止日跨回去年', () => {
    const d = planDeadline('2027-01-02', 3)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 30])
  })
})

describe('isPlanOpen（是否仍可填寫）', () => {
  const deadline = planDeadline('2026-07-25') // 跟隨 config

  it('截止前可填', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 20, 8, 0, 0))).toBe(true)
  })

  it('邊際：剛好在截止時刻仍可填', () => {
    expect(isPlanOpen('2026-07-25', deadline)).toBe(true)
  })

  it('邊際：截止後一秒即關閉', () => {
    expect(isPlanOpen('2026-07-25', new Date(deadline.getTime() + 1000))).toBe(false)
  })

  it('聚會日當天已關閉', () => {
    expect(isPlanOpen('2026-07-25', new Date(2026, 6, 25, 9, 0, 0))).toBe(false)
  })
})

describe('feedbackDeadline / isFeedbackOpen（課後反饋：上完課兩天內填寫）', () => {
  it('截止為聚會日後 2 天的 23:59:59（週六上課 → 週一截止）', () => {
    const d = feedbackDeadline('2026-07-25')
    expect([d.getMonth(), d.getDate()]).toEqual([6, 27])
    expect(d.getDay()).toBe(1) // 週一
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59])
  })

  it('上課當天與隔天皆可填', () => {
    expect(isFeedbackOpen('2026-07-25', new Date(2026, 6, 25, 15, 0, 0))).toBe(true)
    expect(isFeedbackOpen('2026-07-25', new Date(2026, 6, 26, 10, 0, 0))).toBe(true)
  })

  it('邊際：截止瞬間（第 2 天 23:59:59）仍可填，後一秒關閉', () => {
    expect(isFeedbackOpen('2026-07-25', new Date(2026, 6, 27, 23, 59, 59))).toBe(true)
    expect(isFeedbackOpen('2026-07-25', new Date(2026, 6, 28, 0, 0, 0))).toBe(false)
  })

  it('邊際：聚會日在月底 → 截止跨月', () => {
    const d = feedbackDeadline('2026-07-31')
    expect([d.getMonth(), d.getDate()]).toEqual([7, 2]) // 8/2
  })

  it('期限天數可設定', () => {
    const d = feedbackDeadline('2026-07-25', 5)
    expect([d.getMonth(), d.getDate()]).toEqual([6, 30])
  })
})

describe('recordsRangeStart（出席紀錄查詢起點：近半年）', () => {
  it('回傳 6 個月前的日期', () => {
    expect(recordsRangeStart(D(2026, 7, 28))).toBe('2026-01-28')
  })

  it('邊際：跨年', () => {
    expect(recordsRangeStart(D(2026, 3, 15))).toBe('2025-09-15')
  })

  it('月數可設定', () => {
    expect(recordsRangeStart(D(2026, 7, 28), 1)).toBe('2026-06-28')
  })
})

describe('顯示文字', () => {
  it('formatGathering 格式化為 YYYY/MM/DD（聚會日）——聚會在週六，寫「主日」會被讀成星期日', () => {
    expect(formatGathering('2026-07-25')).toBe('2026/07/25（聚會日）')
  })

  it('weekdayName 回傳中文週名', () => {
    expect(weekdayName(D(2026, 7, 22))).toBe('週三')
    expect(weekdayName(D(2026, 7, 25))).toBe('週六')
    expect(weekdayName(D(2026, 7, 26))).toBe('週日')
  })
})

describe('recentGatherings（近三週走勢用）', () => {
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

  it('回傳近 N 次聚會日，舊 → 新、間隔 7 天、最後一筆＝最近一次聚會', () => {
    // 以週六聚會為例：2026-08-05（週三）往回推
    const dates = recentGatherings(3, D(2026, 8, 5), 6)
    expect(dates).toEqual(['2026-07-18', '2026-07-25', '2026-08-01'])
  })

  it('邊際：當天就是聚會日時，包含當天', () => {
    const dates = recentGatherings(2, D(2026, 8, 1), 6)
    expect(dates).toEqual(['2026-07-25', '2026-08-01'])
  })

  it('邊際：可跨月', () => {
    const dates = recentGatherings(4, D(2026, 8, 5), 6)
    expect(dates[0]).toBe('2026-07-11')
  })
})

describe('shortDate', () => {
  it('轉為 M/D（去前導零）', () => {
    expect(shortDate('2026-07-18')).toBe('7/18')
    expect(shortDate('2026-08-01')).toBe('8/1')
    expect(shortDate('2026-12-25')).toBe('12/25')
  })
})

describe('nextGathering（歌單「下週」標籤用）', () => {
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

  it('回傳本週聚會日 + 7 天', () => {
    expect(nextGathering(D(2026, 8, 5), 6)).toBe('2026-08-15') // 本週 8/8 → 下週 8/15
  })

  it('邊際：當天就是聚會日時，下週＝當天 + 7', () => {
    expect(nextGathering(D(2026, 8, 1), 6)).toBe('2026-08-08')
  })
})

describe('upcomingGatherings（服事報名日期清單）', () => {
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

  it('回傳未來 N 次聚會日，含本週、間隔 7 天', () => {
    expect(upcomingGatherings(3, D(2026, 8, 5), 6)).toEqual([
      '2026-08-08',
      '2026-08-15',
      '2026-08-22',
    ])
  })

  it('邊際：當天是聚會日時，第一筆＝當天；可跨月', () => {
    const dates = upcomingGatherings(5, D(2026, 8, 29), 6)
    expect(dates[0]).toBe('2026-08-29')
    expect(dates[4]).toBe('2026-09-26')
  })
})

describe('單次改期（GATHERING_OVERRIDES）', () => {
  it('設定：12/5 園遊會，該週改到 12/6；其他週不受影響', async () => {
    const { GATHERING_OVERRIDES } = await import('../config')
    expect(GATHERING_OVERRIDES['2026-12-05']).toBe('2026-12-06')
    expect(upcomingGathering(D(2026, 11, 25))).toBe('2026-11-28')
    expect(upcomingGathering(D(2026, 12, 7))).toBe('2026-12-12')
  })

  it('upcoming：改期那週（含原定日 12/5 與改到的 12/6 當天）都指向 12/6', () => {
    expect(upcomingGathering(D(2026, 12, 2))).toBe('2026-12-06')
    expect(upcomingGathering(D(2026, 12, 5))).toBe('2026-12-06')
    expect(upcomingGathering(D(2026, 12, 6))).toBe('2026-12-06')
  })

  it('last：12/5 當天上一次聚會仍是 11/28；12/6 起是 12/6', () => {
    expect(lastGathering(D(2026, 12, 5))).toBe('2026-11-28')
    expect(lastGathering(D(2026, 12, 6))).toBe('2026-12-06')
    expect(lastGathering(D(2026, 12, 11))).toBe('2026-12-06')
  })

  it('截止時間依實際聚會日重算：12/6 聚會 → 12/5 23:59 截止', () => {
    expect(planDeadline('2026-12-06').getDate()).toBe(5)
  })

  it('日期清單與 next 一併套用', () => {
    expect(upcomingGatherings(3, D(2026, 11, 30))).toEqual(['2026-12-06', '2026-12-12', '2026-12-19'])
    expect(recentGatherings(3, D(2026, 12, 13))).toEqual(['2026-11-28', '2026-12-06', '2026-12-12'])
    expect(nextGathering(D(2026, 11, 28))).toBe('2026-12-06')
    expect(nextGathering(D(2026, 11, 29))).toBe('2026-12-12')
  })

  it('改期可往前挪（自訂 overrides）', () => {
    const ov = { '2026-08-01': '2026-07-31' }
    expect(upcomingGathering(D(2026, 7, 26), 6, ov)).toBe('2026-07-31')
    expect(upcomingGathering(D(2026, 8, 1), 6, ov)).toBe('2026-08-08')
    expect(lastGathering(D(2026, 8, 1), 6, ov)).toBe('2026-07-31')
  })

  it('isGatheringDate：原定日不算、改到的日期算', () => {
    expect(isGatheringDate('2026-12-05')).toBe(false)
    expect(isGatheringDate('2026-12-06')).toBe(true)
    expect(isGatheringDate('2026-12-12')).toBe(true)
    expect(isGatheringDate('2026-12-13')).toBe(false)
  })

  it('平日改期：週六 11/14 → 下週二 11/17（國定假日），原定日到新日期之間的空檔也正確', () => {
    const ov = { '2026-11-14': '2026-11-17' }
    expect(upcomingGathering(D(2026, 11, 14), 6, ov)).toBe('2026-11-17')
    expect(upcomingGathering(D(2026, 11, 18), 6, ov)).toBe('2026-11-21') // 改期後下週六照常
    // 11/15～11/16：原定日已過、新日期未到 → 上一次仍是 11/07（修正前會回傳 undefined）
    expect(lastGathering(D(2026, 11, 15), 6, ov)).toBe('2026-11-07')
    expect(lastGathering(D(2026, 11, 16), 6, ov)).toBe('2026-11-07')
    expect(recentGatherings(3, D(2026, 11, 16), 6, ov)).toEqual(['2026-10-24', '2026-10-31', '2026-11-07'])
    expect(recentGatherings(3, D(2026, 11, 22), 6, ov)).toEqual(['2026-11-07', '2026-11-17', '2026-11-21'])
    expect(nextGathering(D(2026, 11, 15), 6, ov)).toBe('2026-11-21')
    expect(isGatheringDate('2026-11-14', 6, ov)).toBe(false)
    expect(isGatheringDate('2026-11-17', 6, ov)).toBe(true)
    // 週二聚會 → 前一天（週一）23:59 截止
    const dl = planDeadline('2026-11-17')
    expect([dl.getMonth() + 1, dl.getDate(), dl.getHours(), dl.getMinutes()]).toEqual([11, 16, 23, 59])
  })

  it('改期挪超過一週（跨過下一個週六）也不漏、順序正確', () => {
    const later = { '2026-11-14': '2026-11-24' }
    expect(upcomingGatherings(3, D(2026, 11, 11), 6, later)).toEqual(['2026-11-21', '2026-11-24', '2026-11-28'])
    expect(lastGathering(D(2026, 11, 18), 6, later)).toBe('2026-11-07')
    expect(recentGatherings(3, D(2026, 11, 24), 6, later)).toEqual(['2026-11-07', '2026-11-21', '2026-11-24'])
    const earlier = { '2026-11-28': '2026-11-16' }
    expect(upcomingGatherings(3, D(2026, 11, 15), 6, earlier)).toEqual(['2026-11-16', '2026-11-21', '2026-12-05'])
    expect(upcomingGathering(D(2026, 11, 22), 6, earlier)).toBe('2026-12-05')
    expect(lastGathering(D(2026, 11, 28), 6, earlier)).toBe('2026-11-21')
  })

  it('同時多筆改期互不干擾', () => {
    const ov = { '2026-11-14': '2026-11-17', '2026-12-05': '2026-12-06' }
    expect(upcomingGatherings(5, D(2026, 11, 12), 6, ov)).toEqual([
      '2026-11-17', '2026-11-21', '2026-11-28', '2026-12-06', '2026-12-12',
    ])
  })
})
