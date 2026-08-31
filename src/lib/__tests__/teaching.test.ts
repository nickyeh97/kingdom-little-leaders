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

describe('首頁課堂紀錄提醒：沒填就提醒同工與該班老師（v9 驗收回饋修訂）', () => {
  const all = () => true
  const onlyKid = (id: string) => id === 'kid'

  it('該班已有人填 → 不提醒（同班一份即可）', () => {
    const checks = [{ class_group_id: 'kid' }]
    expect(classesMissingLog(checks, [{ class_group_id: 'kid' }], all)).toEqual([])
  })

  it('同工看得到所有沒填的班別', () => {
    const checks = [{ class_group_id: 'kid' }, { class_group_id: 'toddler' }]
    expect(classesMissingLog(checks, [{ class_group_id: 'kid' }], all)).toEqual(['toddler'])
    expect(classesMissingLog(checks, [], all)).toEqual(['kid', 'toddler'])
  })

  it('老師只被自己被指派的班提醒（不是被指派的班不打擾）', () => {
    const checks = [{ class_group_id: 'kid' }, { class_group_id: 'toddler' }]
    expect(classesMissingLog(checks, [], onlyKid)).toEqual(['kid'])
  })

  it('關鍵：不看是誰點的名——別人點的名，該班老師與同工照樣被提醒', () => {
    // checks 不再帶 checked_by，任何一筆點名都代表「那天有上課」
    const checks = [{ class_group_id: 'kid' }]
    expect(classesMissingLog(checks, [], all)).toEqual(['kid'])
    expect(classesMissingLog(checks, [], onlyKid)).toEqual(['kid'])
  })

  it('邊際：同班多筆點名只回報一次；沒有點名（沒上課）就不提醒', () => {
    const checks = [{ class_group_id: 'kid' }, { class_group_id: 'kid' }]
    expect(classesMissingLog(checks, [], all)).toEqual(['kid'])
    expect(classesMissingLog([], [], all)).toEqual([])
  })
})
