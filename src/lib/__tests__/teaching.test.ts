import { describe, expect, it } from 'vitest'
import { LESSON_ITEM_PRESETS, MATERIAL_CATEGORY_PRESETS } from '../teaching'

describe('教學模組設定', () => {
  it('教案項目選項源自現行共編 Excel 的流程段落', () => {
    expect(LESSON_ITEM_PRESETS).toContain('信息')
    expect(LESSON_ITEM_PRESETS).toContain('敬拜')
    expect(LESSON_ITEM_PRESETS).toContain('彈性時間')
  })

  it('教材目錄有建議選項', () => {
    expect(MATERIAL_CATEGORY_PRESETS.length).toBeGreaterThan(0)
    expect(MATERIAL_CATEGORY_PRESETS).toContain('PPT')
  })
})
