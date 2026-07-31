import { describe, expect, it } from 'vitest'
import { addMonths, monthGrid, monthOf, monthRange, monthTitle } from '../calendar'
import { GATHERING_WEEKDAY } from '../config'

describe('出席行事曆 月曆格工具', () => {
  it('monthOf 取出 YYYY-MM', () => {
    expect(monthOf('2026-08-01')).toBe('2026-08')
  })

  it('addMonths 位移月份，可跨年', () => {
    expect(addMonths('2026-08', 1)).toBe('2026-09')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('monthTitle 顯示中文年月', () => {
    expect(monthTitle('2026-08')).toBe('2026 年 8 月')
  })

  it('monthRange 回傳月初與月底（含大小月/閏年）', () => {
    expect(monthRange('2026-08')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('monthGrid 補位對齊完整週：長度為 7 的倍數、首格為週日', () => {
    const cells = monthGrid('2026-08') // 2026-08-01 是週六
    expect(cells.length % 7).toBe(0)
    expect(new Date(`${cells[0].date}T00:00:00`).getDay()).toBe(0)
    const lastCell = cells[cells.length - 1]
    expect(new Date(`${lastCell.date}T00:00:00`).getDay()).toBe(6)
  })

  it('monthGrid 涵蓋整月且 inMonth 標記正確', () => {
    const cells = monthGrid('2026-08')
    const inMonth = cells.filter((c) => c.inMonth)
    expect(inMonth.length).toBe(31)
    expect(inMonth[0].date).toBe('2026-08-01')
    expect(inMonth[inMonth.length - 1].date).toBe('2026-08-31')
    // 補位格標記為非當月
    expect(cells[0].inMonth).toBe(false) // 2026-07-26（週日補位）
  })

  it('monthGrid 聚會日旗標跟著設定的週幾（不寫死）', () => {
    const cells = monthGrid('2026-08')
    for (const c of cells) {
      expect(c.isGathering).toBe(new Date(`${c.date}T00:00:00`).getDay() === GATHERING_WEEKDAY)
    }
  })

  it('邊際：可用參數覆寫聚會週幾（未來改後台設定時不需改演算法）', () => {
    const cells = monthGrid('2026-08', 0) // 假設改為週日聚會
    const gatherings = cells.filter((c) => c.inMonth && c.isGathering)
    for (const g of gatherings) {
      expect(new Date(`${g.date}T00:00:00`).getDay()).toBe(0)
    }
    expect(gatherings.length).toBeGreaterThan(0)
  })
})
