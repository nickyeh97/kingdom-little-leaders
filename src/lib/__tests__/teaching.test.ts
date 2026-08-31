import { describe, expect, it } from 'vitest'
import { LESSON_ITEM_PRESETS, MATERIAL_CATEGORY_PRESETS, classesMissingLog } from '../teaching'

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

describe('首頁課堂紀錄提醒：只提醒真的沒填的班（v9 驗收回饋）', () => {
  const me = 'u1'

  it('我點名的班已有人填 → 不提醒（同班一份即可，不必每位老師各填）', () => {
    const checks = [{ class_group_id: 'kid', checked_by: me }]
    const logs = [{ class_group_id: 'kid' }] // 由別位老師填寫
    expect(classesMissingLog(checks, logs, me)).toEqual([])
  })

  it('只回報「我點過名且該班沒紀錄」的班別', () => {
    const checks = [
      { class_group_id: 'kid', checked_by: me },
      { class_group_id: 'toddler', checked_by: me },
    ]
    expect(classesMissingLog(checks, [{ class_group_id: 'kid' }], me)).toEqual(['toddler'])
  })

  it('邊際：別人點名的班不算我的責任', () => {
    const checks = [{ class_group_id: 'toddler', checked_by: 'other' }]
    expect(classesMissingLog(checks, [], me)).toEqual([])
  })

  it('邊際：同班多筆點名只回報一次；未登入回空陣列', () => {
    const checks = [
      { class_group_id: 'kid', checked_by: me },
      { class_group_id: 'kid', checked_by: me },
    ]
    expect(classesMissingLog(checks, [], me)).toEqual(['kid'])
    expect(classesMissingLog(checks, [], undefined)).toEqual([])
  })
})
