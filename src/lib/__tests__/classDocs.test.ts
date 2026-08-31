import { describe, expect, it } from 'vitest'
import { parseMinutes, planInsert, stripMinutes } from '../classInfo'
import { LESSON_TEMPLATE, templateFromFlows } from '../lesson'

describe('聚會流程建議時間（v9 #3）', () => {
  it('從舊的 extra 文字解析分鐘數', () => {
    expect(parseMinutes('必做・約5分鐘')).toBe(5)
    expect(parseMinutes('選做・約10分鐘')).toBe(10)
    expect(parseMinutes('必做・15分')).toBe(15)
  })

  it('邊際：沒有時間文字、空值回 null（不亂猜）', () => {
    expect(parseMinutes('必做')).toBeNull()
    expect(parseMinutes('')).toBeNull()
    expect(parseMinutes(null)).toBeNull()
  })

  it('去掉時間文字後只留必要性，避免卡片重複顯示時間', () => {
    expect(stripMinutes('必做・約5分鐘')).toBe('必做')
    expect(stripMinutes('選做・約10分鐘')).toBe('選做')
    expect(stripMinutes('必做')).toBe('必做')
    expect(stripMinutes('')).toBe('')
  })
})

describe('插入位置重排（v9 #3）', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('插在最前面：三項全部往後挪', () => {
    expect(planInsert(items, 0)).toEqual([
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
      { id: 'c', sort_order: 3 },
    ])
  })

  it('插在中間：只有後面的項目要挪', () => {
    expect(planInsert(items, 2)).toEqual([{ id: 'c', sort_order: 3 }])
  })

  it('邊際：插在最後不需要挪動任何項目', () => {
    expect(planInsert(items, 3)).toEqual([])
    expect(planInsert([], 0)).toEqual([])
  })
})

describe('教案範本改依聚會流程（v9 #4）', () => {
  it('以流程項目為段落、帶入建議分鐘', () => {
    const flows = [
      { title: '服事分工', minutes: 5 },
      { title: '敬拜', minutes: 20 },
    ]
    expect(templateFromFlows(flows)).toEqual([
      { minutes: 5, item: '服事分工' },
      { minutes: 20, item: '敬拜' },
    ])
  })

  it('邊際：流程沒填分鐘時保留 null（時間連動會自行停止推算）', () => {
    expect(templateFromFlows([{ title: '自由活動', minutes: null }])).toEqual([
      { minutes: null, item: '自由活動' },
    ])
  })

  it('邊際：該班沒有流程資料時，呼叫端退回內建 11 段範本', () => {
    expect(templateFromFlows([])).toEqual([])
    expect(LESSON_TEMPLATE.length).toBe(11)
  })
})
