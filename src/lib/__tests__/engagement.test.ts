import { describe, expect, it } from 'vitest'
import { ENGAGEMENT_LEVELS, classHasIndex, engagementOf } from '../engagement'

describe('專心/配合指數', () => {
  it('量表為 4 級、由高到低（S2 顯示順序），語彙為狀態而非成績', () => {
    expect(ENGAGEMENT_LEVELS.map((l) => l.value)).toEqual([4, 3, 2, 1])
    expect(ENGAGEMENT_LEVELS.map((l) => l.emoji)).toEqual(['😍', '🙂', '😐', '🥱'])
    expect(ENGAGEMENT_LEVELS.map((l) => l.label)).toEqual([
      '非常投入',
      '投入',
      '普通',
      '需要休息',
    ])
  })

  it('engagementOf 由值取級距', () => {
    expect(engagementOf(4)?.label).toBe('非常投入')
    expect(engagementOf(1)?.emoji).toBe('🥱')
  })

  it('邊際：未評（null/undefined）與範圍外的值回傳 null', () => {
    expect(engagementOf(null)).toBeNull()
    expect(engagementOf(undefined)).toBeNull()
    expect(engagementOf(0)).toBeNull()
    expect(engagementOf(5)).toBeNull()
  })

  it('classHasIndex：幼幼班不評指數，其餘班別評', () => {
    expect(classHasIndex('兒童班')).toBe(true)
    expect(classHasIndex('幼童班')).toBe(true)
    expect(classHasIndex('幼幼班')).toBe(false)
  })

  it('邊際：班別未知（null/空字串）視為不評，避免誤顯示指數列', () => {
    expect(classHasIndex(null)).toBe(false)
    expect(classHasIndex(undefined)).toBe(false)
    expect(classHasIndex('')).toBe(false)
  })
})
