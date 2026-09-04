import { describe, expect, it } from 'vitest'
import { ROLE_LABELS, roleLabel, roleTagStyle } from '../roleColor'
import type { UserRole } from '../../types'

const ROLES: UserRole[] = ['admin', 'teacher', 'parent']

describe('角色標籤顏色與文字（v11 #7）', () => {
  it('三個角色都有中文標籤', () => {
    expect(ROLES.map((r) => roleLabel(r))).toEqual(['管理者', '老師', '家長'])
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(['admin', 'parent', 'teacher'])
  })

  it('三個角色各自不同色，不會整排同色', () => {
    const backgrounds = new Set(ROLES.map((r) => roleTagStyle(r).background))
    expect(backgrounds.size).toBe(3)
  })

  it('底色與文字色成對，不會拿底色當字色', () => {
    for (const r of ROLES) {
      const s = roleTagStyle(r)
      expect(s.color).not.toBe(s.background)
    }
  })

  it('邊際：未知角色不會壞掉，仍拿得到可用的樣式與文字', () => {
    const unknown = 'visitor' as UserRole
    expect(roleTagStyle(unknown).background).toBeTruthy()
    expect(roleLabel(unknown)).toBe('visitor')
  })
})
