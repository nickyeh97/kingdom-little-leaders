import { describe, expect, it } from 'vitest'
import { FLOW_TEMPLATE, GUIDE_TEMPLATE } from '../classInfo'

describe('聚會流程標準範本（源自共編 Excel 兒童班流程）', () => {
  it('涵蓋共編的 11 項流程與備註要點', () => {
    expect(FLOW_TEMPLATE).toHaveLength(11)
    expect(FLOW_TEMPLATE.map((t) => t.title)).toContain('國度領袖兒童宣言')
    expect(GUIDE_TEMPLATE.length).toBeGreaterThan(0)
  })

  it('每項流程都標示必做/選做（老師寫教案的依據）', () => {
    for (const t of FLOW_TEMPLATE) {
      expect(t.extra.startsWith('必做') || t.extra.startsWith('選做')).toBe(true)
    }
  })

  it('必做項目時長回推自教案標準流程（敬拜10、信息30）', () => {
    const byTitle = new Map(FLOW_TEMPLATE.map((t) => [t.title, t.extra]))
    expect(byTitle.get('敬拜')).toContain('10分鐘')
    expect(byTitle.get('信息')).toContain('30分鐘')
    expect(byTitle.get('奉獻')).toContain('5分鐘')
  })
})
