import { describe, expect, it } from 'vitest'
import {
  LESSON_TEMPLATE,
  addToClock,
  composeTimeText,
  normalizeClock,
  parseTimeText,
  totalMinutes,
} from '../lesson'

describe('教案時間工具', () => {
  it('normalizeClock 相容 1400／14:00／930', () => {
    expect(normalizeClock('1400')).toBe('14:00')
    expect(normalizeClock('14:00')).toBe('14:00')
    expect(normalizeClock('930')).toBe('09:30')
  })

  it('邊際：無法解析回傳空字串', () => {
    expect(normalizeClock('abc')).toBe('')
    expect(normalizeClock('2570')).toBe('')
    expect(normalizeClock('')).toBe('')
  })

  it('addToClock 跨小時進位', () => {
    expect(addToClock('14:55', 10)).toBe('15:05')
    expect(addToClock('1400', 30)).toBe('14:30')
  })

  it('parseTimeText 解析 Excel 慣用格式', () => {
    expect(parseTimeText('5分鐘 1400-1405')).toEqual({ minutes: 5, start: '14:00', end: '14:05' })
    expect(parseTimeText('40分鐘 1430 - 1510')).toEqual({
      minutes: 40,
      start: '14:30',
      end: '15:10',
    })
    expect(parseTimeText('10分鐘')).toEqual({ minutes: 10, start: '', end: '' })
  })

  it('parseTimeText 只有起始時間時以分鐘推得結束', () => {
    expect(parseTimeText('15分鐘 14:00')).toEqual({ minutes: 15, start: '14:00', end: '14:15' })
  })

  it('composeTimeText 由分鐘＋開始時間組合', () => {
    expect(composeTimeText(10, '14:00')).toBe('10分鐘 14:00-14:10')
    expect(composeTimeText(10, '')).toBe('10分鐘')
    expect(composeTimeText(null, '1400')).toBe('14:00')
    expect(composeTimeText(null, '')).toBe('')
  })

  it('totalMinutes 加總（不可解析者視為 0）', () => {
    expect(totalMinutes(['5分鐘 1400-1405', '30分鐘', '亂填'])).toBe(35)
  })

  it('標準流程＝課程流程 11 項共 88 分鐘（v6 #5a）', () => {
    expect(LESSON_TEMPLATE).toHaveLength(11)
    expect(totalMinutes(LESSON_TEMPLATE.map((t) => `${t.minutes}分鐘`))).toBe(88)
    expect(LESSON_TEMPLATE[0].item).toBe('服事分工')
  })
})
