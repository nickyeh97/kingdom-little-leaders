import { afterEach, describe, expect, it, vi } from 'vitest'
import { spiritBeastEligible, spiritGameBaseUrl, spiritGameLink } from '../spiritGame'
import type { ClassGroup } from '../../types'

const CHILD = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const cls = (name: string): ClassGroup => ({ id: 'c', name, sort_order: 1 })

describe('spiritGameLink', () => {
  it('把 token 與孩子 id 放在網址片段', () => {
    expect(spiritGameLink('https://game.example', 'abc.def.ghi', CHILD)).toBe(
      `https://game.example#at=abc.def.ghi&child=${CHILD}`,
    )
  })

  it('邊際：token 內的特殊字元會編碼，遊戲端解碼後一致', () => {
    const link = spiritGameLink('https://game.example/', 'a+b/c=&d', CHILD)
    expect(link).toBe(`https://game.example/#at=a%2Bb%2Fc%3D%26d&child=${CHILD}`)
    const at = new URLSearchParams(link.split('#')[1]).get('at')
    expect(at).toBe('a+b/c=&d')
  })

  it('邊際：設定的網址若已帶片段，會被取代而不是疊加', () => {
    expect(spiritGameLink('https://game.example/#old', 't', CHILD)).toBe(
      `https://game.example/#at=t&child=${CHILD}`,
    )
  })
})

describe('spiritGameBaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('未設定時回空字串（入口不顯示）', () => {
    vi.stubEnv('VITE_SPIRIT_GAME_URL', '')
    expect(spiritGameBaseUrl()).toBe('')
  })

  it('沿用網址正規化：補 https、拒絕非 http 協定', () => {
    vi.stubEnv('VITE_SPIRIT_GAME_URL', ' game.example ')
    expect(spiritGameBaseUrl()).toBe('https://game.example')
    vi.stubEnv('VITE_SPIRIT_GAME_URL', 'javascript:alert(1)')
    expect(spiritGameBaseUrl()).toBe('')
  })
})

describe('spiritBeastEligible', () => {
  it('兒童班、幼童班可用；幼幼班不納入', () => {
    expect(spiritBeastEligible({ class_groups: cls('兒童班') })).toBe(true)
    expect(spiritBeastEligible({ class_groups: cls('幼童班') })).toBe(true)
    expect(spiritBeastEligible({ class_groups: cls('幼幼班') })).toBe(false)
  })

  it('邊際：班別資料缺漏時不顯示', () => {
    expect(spiritBeastEligible({})).toBe(false)
  })
})
