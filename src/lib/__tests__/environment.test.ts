import { describe, expect, it } from 'vitest'
import { PRODUCTION_SUPABASE_HOST, stagingPointsToProduction, supabaseHost } from '../environment'

describe('supabaseHost', () => {
  it('去掉協定與結尾斜線', () => {
    expect(supabaseHost('https://abc.supabase.co/')).toBe('abc.supabase.co')
    expect(supabaseHost(' https://abc.supabase.co ')).toBe('abc.supabase.co')
  })
  it('邊際：沒設定回空字串', () => {
    expect(supabaseHost(undefined)).toBe('')
  })
})

describe('stagingPointsToProduction', () => {
  const prod = `https://${PRODUCTION_SUPABASE_HOST}`
  it('測試站設定成正式資料庫 → 擋下（2026-11-01 實際發生）', () => {
    expect(stagingPointsToProduction('staging', prod)).toBe(true)
    expect(stagingPointsToProduction('staging', prod + '/')).toBe(true)
  })
  it('測試站連測試資料庫 → 放行', () => {
    expect(stagingPointsToProduction('staging', 'https://test-ref.supabase.co')).toBe(false)
  })
  it('正式建置與一般開發連正式資料庫 → 放行', () => {
    expect(stagingPointsToProduction('production', prod)).toBe(false)
    expect(stagingPointsToProduction('development', prod)).toBe(false)
  })
})
