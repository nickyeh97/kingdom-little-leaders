import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_CATEGORIES,
  CATEGORY_ALL,
  announcementDateText,
  categoryIcon,
  categoryStyle,
  filterByCategory,
  isCategory,
  normalizeCategory,
  showCategoryFilter,
  wasEdited,
} from '../announcement'

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

describe('公告分類（v0.3.2）', () => {
  const list = [
    { tag: '行政', title: 'a' },
    { tag: '課程', title: 'b' },
    { tag: '行政', title: 'c' },
  ]

  it('分類只有行政與課程兩種', () => {
    expect([...ANNOUNCEMENT_CATEGORIES]).toEqual(['行政', '課程'])
    expect(isCategory('行政')).toBe(true)
    expect(isCategory('課程')).toBe(true)
    expect(isCategory('重要')).toBe(false)
  })

  it('篩選只過濾、不改順序', () => {
    expect(filterByCategory(list, '行政').map((a) => a.title)).toEqual(['a', 'c'])
    expect(filterByCategory(list, '課程').map((a) => a.title)).toEqual(['b'])
  })

  it('空字串＝全部，回傳同一份順序', () => {
    expect(filterByCategory(list, CATEGORY_ALL).map((a) => a.title)).toEqual(['a', 'b', 'c'])
  })

  it('邊際：分類不存在時回空陣列，不會壞掉', () => {
    expect(filterByCategory(list, '不存在的分類')).toEqual([])
    expect(filterByCategory([], '行政')).toEqual([])
  })

  it('只有一種分類（或沒有公告）時不顯示篩選列', () => {
    expect(showCategoryFilter(list)).toBe(true)
    expect(showCategoryFilter([{ tag: '行政' }, { tag: '行政' }])).toBe(false)
    expect(showCategoryFilter([])).toBe(false)
  })

  it('兩種分類的顏色與圖示不同，且底色不等於字色', () => {
    const admin = categoryStyle('行政')
    const course = categoryStyle('課程')
    expect(admin.background).not.toBe(course.background)
    expect(admin.color).not.toBe(admin.background)
    expect(categoryIcon('行政')).not.toBe(categoryIcon('課程'))
  })
})

describe('normalizeCategory：舊值相容（部署與 migration 的空窗期）', () => {
  it('新值原樣保留', () => {
    expect(normalizeCategory('行政')).toBe('行政')
    expect(normalizeCategory('課程')).toBe('課程')
  })

  it('舊的「重要」（多為課堂提醒）對到課程，其餘對到行政', () => {
    expect(normalizeCategory('重要')).toBe('課程')
    expect(normalizeCategory('公告')).toBe('行政')
  })

  it('邊際：空值、空白、未知文字都回預設分類，畫面不會出現空標籤', () => {
    expect(normalizeCategory(null)).toBe('行政')
    expect(normalizeCategory(undefined)).toBe('行政')
    expect(normalizeCategory('  ')).toBe('行政')
    expect(normalizeCategory('隨便打的')).toBe('行政')
  })
})
