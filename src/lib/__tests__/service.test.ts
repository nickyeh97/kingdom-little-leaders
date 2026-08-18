import { describe, expect, it } from 'vitest'
import {
  CHILD_SERVICE_ITEM_PRESETS,
  SERVICE_ITEM_PRESETS,
  SIGNUP_WEEKS_AHEAD,
} from '../service'

describe('服事排班設定', () => {
  it('提供服事項目建議選項（字典未定案，僅建議非限定）', () => {
    expect(SERVICE_ITEM_PRESETS.length).toBeGreaterThan(0)
    expect(SERVICE_ITEM_PRESETS).toContain('敬拜')
    expect(SERVICE_ITEM_PRESETS).toContain('信息')
  })

  it('報名開放未來 8 次聚會', () => {
    expect(SIGNUP_WEEKS_AHEAD).toBe(8)
  })

  it('兒童服事有獨立的建議選項（源自教案分工服事）', () => {
    expect(CHILD_SERVICE_ITEM_PRESETS.length).toBeGreaterThan(0)
    expect(CHILD_SERVICE_ITEM_PRESETS).toContain('收奉獻')
  })
})
