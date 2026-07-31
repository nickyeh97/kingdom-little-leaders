import { describe, expect, it } from 'vitest'
import {
  FAMILIARITY_MAX_LABEL,
  FAMILIARITY_MIN_LABEL,
  FAMILIARITY_VALUES,
  familiarityText,
} from '../familiarity'

describe('詩歌兩維熟悉度（v4 決議 3：1–5）', () => {
  it('量表為 1–5，1＝不熟、5＝熟悉', () => {
    expect(FAMILIARITY_VALUES).toEqual([1, 2, 3, 4, 5])
    expect(FAMILIARITY_MIN_LABEL).toBe('不熟')
    expect(FAMILIARITY_MAX_LABEL).toBe('熟悉')
  })

  it('familiarityText 顯示 N/5', () => {
    expect(familiarityText(1)).toBe('1/5')
    expect(familiarityText(5)).toBe('5/5')
  })

  it('邊際：未填與範圍外回傳 null', () => {
    expect(familiarityText(null)).toBeNull()
    expect(familiarityText(undefined)).toBeNull()
    expect(familiarityText(0)).toBeNull()
    expect(familiarityText(6)).toBeNull()
  })
})
