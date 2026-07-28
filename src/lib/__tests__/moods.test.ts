import { describe, expect, it } from 'vitest'
import { MOOD_OPTIONS, moodKey } from '../moods'

describe('課堂表現表情選項', () => {
  it('至少提供十個以上選項（規格：十幾種表情）', () => {
    expect(MOOD_OPTIONS.length).toBeGreaterThanOrEqual(10)
  })

  it('每個選項都有 emoji 與文字說明', () => {
    for (const m of MOOD_OPTIONS) {
      expect(m.emoji.trim()).not.toBe('')
      expect(m.label.trim()).not.toBe('')
    }
  })

  it('選項 label 不重複（避免儲存後無法辨識）', () => {
    const labels = MOOD_OPTIONS.map((m) => m.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('moodKey 產生「emoji label」格式，且各選項的 key 唯一', () => {
    const keys = MOOD_OPTIONS.map(moodKey)
    expect(keys[0]).toBe(`${MOOD_OPTIONS[0].emoji} ${MOOD_OPTIONS[0].label}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('守則檢核：不得出現羞辱性字眼（紅燈 #7）', () => {
    const banned = ['差', '爛', '壞', '懶', '笨', '吵', '搗蛋', '不乖', '退步']
    for (const m of MOOD_OPTIONS) {
      for (const word of banned) {
        expect(m.label).not.toContain(word)
      }
    }
  })
})
