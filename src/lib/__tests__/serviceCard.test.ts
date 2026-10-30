import { describe, expect, it } from 'vitest'
import {
  entryDate,
  level,
  parseEncouragements,
  serviceCardRows,
  stage,
  stageName,
} from '../serviceCard'

// 與遊戲 repo 的 Core 測試同一組案例（GDD §8.3）：兩邊算出來的等級、階段必須一致

describe('等級＝次數＋1', () => {
  it('還沒服事過是一等，第一次服事升二等', () => {
    expect(level(0)).toBe(1)
    expect(level(1)).toBe(2)
    expect(level(9)).toBe(10)
  })
  it('邊際：負數當 0', () => {
    expect(level(-3)).toBe(1)
  })
})

describe('階段（門檻 0／4／12／24）', () => {
  it.each([
    [0, 1],
    [3, 1],
    [4, 2],
    [11, 2],
    [12, 3],
    [23, 3],
    [24, 4],
    [100, 4],
  ])('總次數 %i → 階段 %i', (total, s) => {
    expect(stage(total)).toBe(s)
  })
  it('階段名稱', () => {
    expect(stageName(0)).toBe('初生')
    expect(stageName(4)).toBe('成長')
    expect(stageName(12)).toBe('茁壯')
    expect(stageName(24)).toBe('小領袖')
  })
})

describe('serviceCardRows', () => {
  const items = [
    { name: '敬拜-司琴', sort_order: 2, active: true },
    { name: '奉獻服事長', sort_order: 1, active: true },
    { name: '已停用沒紀錄', sort_order: 3, active: false },
  ]
  it('啟用中的項目依字典順序；沒服事過的也列出（一等）', () => {
    const rows = serviceCardRows(items, [{ item: '奉獻服事長' }, { item: '奉獻服事長' }])
    expect(rows).toEqual([
      { item: '奉獻服事長', count: 2, level: 3, retired: false },
      { item: '敬拜-司琴', count: 0, level: 1, retired: false },
    ])
  })
  it('邊際：字典停用或改名的舊紀錄照樣計數，排在後面', () => {
    const rows = serviceCardRows(items, [{ item: '收奉獻' }])
    expect(rows[rows.length - 1]).toEqual({ item: '收奉獻', count: 1, level: 2, retired: true })
  })
  it('邊際：沒有任何紀錄', () => {
    expect(serviceCardRows(items, []).every((r) => r.level === 1)).toBe(true)
  })
})

describe('parseEncouragements', () => {
  it('每行一句，去掉空白與空行', () => {
    expect(parseEncouragements('  你好棒的心！ \n\n謝謝你願意服事\n')).toEqual({
      words: ['你好棒的心！', '謝謝你願意服事'],
      error: null,
    })
  })
  it('邊際：空的＝清掉全部（遊戲改用經文）', () => {
    expect(parseEncouragements('\n  \n')).toEqual({ words: [], error: null })
  })
  it('邊際：超過 5 句', () => {
    expect(parseEncouragements('1\n2\n3\n4\n5\n6').error).toBe('最多 5 句（目前 6 句）')
  })
  it('邊際：剛好 40 字可以，41 字不行', () => {
    expect(parseEncouragements('一'.repeat(40)).error).toBeNull()
    expect(parseEncouragements('好\n' + '一'.repeat(41)).error).toBe('第 2 句超過 40 字')
  })
  it('邊際：表情符號算一個字（跟資料庫 char_length 一致）', () => {
    expect(parseEncouragements('🐑'.repeat(40)).error).toBeNull()
  })
})

describe('entryDate（台灣時間）', () => {
  it('UTC 晚上 4 點後算隔天', () => {
    expect(entryDate('2026-10-24T16:30:00Z')).toBe('2026/10/25')
    expect(entryDate('2026-10-24T15:59:00Z')).toBe('2026/10/24')
  })
})
