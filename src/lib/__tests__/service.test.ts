import { describe, expect, it } from 'vitest'
import {
  CHILD_SERVICE_ITEM_PRESETS,
  SERVICE_ITEM_PRESETS,
  SIGNUP_WEEKS_AHEAD,
} from '../service'

describe('服事排班設定', () => {
  it('服事項目收斂為三項（v5 #2：主責/助教/彈性時間，仍可自由輸入）', () => {
    expect(SERVICE_ITEM_PRESETS).toEqual(['主責', '助教', '彈性時間'])
  })

  it('報名開放未來 8 次聚會', () => {
    expect(SIGNUP_WEEKS_AHEAD).toBe(8)
  })

  it('兒童服事有獨立的建議選項（源自教案分工服事）', () => {
    expect(CHILD_SERVICE_ITEM_PRESETS.length).toBeGreaterThan(0)
    expect(CHILD_SERVICE_ITEM_PRESETS).toContain('收奉獻')
  })
})
