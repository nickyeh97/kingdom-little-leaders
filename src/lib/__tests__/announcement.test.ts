import { describe, expect, it } from 'vitest'
import { announcementDateText, wasEdited } from '../announcement'

describe('公告日期呈現（v11 #8）', () => {
  const created = '2026-07-28T03:38:46.175548+00:00'

  it('沒編輯過只顯示發布日', () => {
    expect(announcementDateText(created, created)).toBe(new Date(created).toLocaleDateString('zh-TW'))
    expect(wasEdited(created, created)).toBe(false)
  })

  it('編輯過會標示編輯日，發布日不變', () => {
    const edited = '2026-09-03T05:00:00+00:00'
    expect(wasEdited(created, edited)).toBe(true)
    const text = announcementDateText(created, edited)
    expect(text).toContain(new Date(created).toLocaleDateString('zh-TW'))
    expect(text).toContain('編輯')
  })

  it('邊際：建立當下兩個時間戳差幾秒不算編輯過', () => {
    expect(wasEdited(created, '2026-07-28T03:38:47.000000+00:00')).toBe(false)
  })

  it('邊際：剛好一分鐘不算、超過一分鐘才算', () => {
    expect(wasEdited('2026-07-28T00:00:00Z', '2026-07-28T00:01:00Z')).toBe(false)
    expect(wasEdited('2026-07-28T00:00:00Z', '2026-07-28T00:01:01Z')).toBe(true)
  })

  it('邊際：updated_at 缺漏或格式壞掉時只顯示發布日，不會爆掉', () => {
    expect(wasEdited(created, null)).toBe(false)
    expect(wasEdited(created, undefined)).toBe(false)
    expect(wasEdited(created, 'not-a-date')).toBe(false)
    expect(announcementDateText(created, null)).toBe(new Date(created).toLocaleDateString('zh-TW'))
  })
})
