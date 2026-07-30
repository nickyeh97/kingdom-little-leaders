import { describe, expect, it } from 'vitest'
import { FAMILIARITY_LEVELS, familiarityLabel } from '../familiarity'

describe('詩歌兩維熟悉度', () => {
  it('量表為 3 級：陌生/練習中/熟悉', () => {
    expect(FAMILIARITY_LEVELS.map((l) => l.value)).toEqual([1, 2, 3])
    expect(FAMILIARITY_LEVELS.map((l) => l.label)).toEqual(['陌生', '練習中', '熟悉'])
  })

  it('familiarityLabel 由值取文字', () => {
    expect(familiarityLabel(1)).toBe('陌生')
    expect(familiarityLabel(3)).toBe('熟悉')
  })

  it('邊際：未填（null/undefined）與範圍外回傳 null', () => {
    expect(familiarityLabel(null)).toBeNull()
    expect(familiarityLabel(undefined)).toBeNull()
    expect(familiarityLabel(0)).toBeNull()
    expect(familiarityLabel(4)).toBeNull()
  })
})
