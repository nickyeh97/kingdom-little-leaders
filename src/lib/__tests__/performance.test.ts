import { describe, expect, it } from 'vitest'
import {
  SCORE_DEFAULT,
  SCORE_VALUES,
  classHasIndex,
  isValidScore,
} from '../performance'

describe('專心度/配合度（v4 決議 2）', () => {
  it('數值範圍 1–5、高到低顯示，預設 5', () => {
    expect(SCORE_VALUES).toEqual([5, 4, 3, 2, 1])
    expect(SCORE_DEFAULT).toBe(5)
  })

  it('isValidScore 驗證範圍', () => {
    expect(isValidScore(1)).toBe(true)
    expect(isValidScore(5)).toBe(true)
    expect(isValidScore(0)).toBe(false)
    expect(isValidScore(6)).toBe(false)
    expect(isValidScore(null)).toBe(false)
    expect(isValidScore(undefined)).toBe(false)
    expect(isValidScore(3.5)).toBe(false)
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
