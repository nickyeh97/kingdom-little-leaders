import { describe, expect, it } from 'vitest'
import {
  LINE_PROVIDER,
  canUnlinkLine,
  findLineIdentity,
  lineBindingLabel,
} from '../lineIdentity'
import type { UserIdentity } from '@supabase/supabase-js'

function identity(provider: string, data: Record<string, unknown> = {}): UserIdentity {
  return {
    id: `id-${provider}`,
    user_id: 'u1',
    identity_id: `iid-${provider}`,
    provider,
    identity_data: data,
    created_at: '2026-09-08T00:00:00Z',
    last_sign_in_at: '2026-09-08T00:00:00Z',
    updated_at: '2026-09-08T00:00:00Z',
  } as UserIdentity
}

const email = identity('email', { email: 'a@b.c' })
const google = identity('google', { email: 'a@b.c', full_name: '王測試' })
const line = identity(LINE_PROVIDER, { name: '小恩' })

describe('LINE 綁定（v15 #1）', () => {
  it('provider 識別字要帶 Supabase 規定的 custom: 前綴', () => {
    expect(LINE_PROVIDER).toBe('custom:line')
  })

  it('找得到／找不到 LINE identity', () => {
    expect(findLineIdentity([email, line])).toBe(line)
    expect(findLineIdentity([email, google])).toBeNull()
    expect(findLineIdentity([])).toBeNull()
    expect(findLineIdentity(null)).toBeNull()
  })

  it('不會把 google 誤認成 LINE——比對的是完整 provider 字串', () => {
    expect(findLineIdentity([identity('line')])).toBeNull() // 少了 custom: 前綴就不算
  })

  it('至少要留一個登入方式，唯一的 LINE 不給解除', () => {
    expect(canUnlinkLine([email, line])).toBe(true)
    expect(canUnlinkLine([line])).toBe(false) // 解了就登不進來
    expect(canUnlinkLine([email, google])).toBe(false) // 根本沒綁 LINE
    expect(canUnlinkLine(null)).toBe(false)
  })

  it('綁定狀態文字：有名字就顯示名字', () => {
    expect(lineBindingLabel([email, line])).toBe('已綁定：小恩')
    expect(lineBindingLabel([email])).toBe('尚未綁定')
  })

  it('邊際：LINE 沒給名字（email scope 未核准時常見）也不能印出 undefined', () => {
    expect(lineBindingLabel([email, identity(LINE_PROVIDER, {})])).toBe('已綁定')
    expect(lineBindingLabel([email, identity(LINE_PROVIDER, { name: '   ' })])).toBe('已綁定')
    expect(lineBindingLabel([email, identity(LINE_PROVIDER, { name: 42 })])).toBe('已綁定')
  })

  it('邊際：identity_data 整個缺失也不會炸', () => {
    const broken = { ...identity(LINE_PROVIDER), identity_data: undefined } as UserIdentity
    expect(lineBindingLabel([email, broken])).toBe('已綁定')
  })

  it('名稱依 name → full_name → preferred_username 順序取用', () => {
    expect(lineBindingLabel([identity(LINE_PROVIDER, { full_name: '小樂' })])).toBe('已綁定：小樂')
    expect(lineBindingLabel([identity(LINE_PROVIDER, { preferred_username: '小光' })])).toBe(
      '已綁定：小光',
    )
  })
})
