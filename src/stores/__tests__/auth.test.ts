import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth'
import type { Profile, UserRole } from '../../types'

function profileWith(roles: UserRole[], approved = true): Profile {
  return {
    id: 'u1',
    display_name: '測試使用者',
    roles,
    approved,
    auth_provider: 'email',
    phone: null,
    created_at: '2026-07-26T00:00:00Z',
  }
}

describe('auth store：標籤式多角色權限', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('未登入（無 profile）時不具任何角色', () => {
    const auth = useAuthStore()
    expect(auth.roles).toEqual([])
    expect(auth.isAdmin).toBe(false)
    expect(auth.can('parent')).toBe(false)
    expect(auth.can('teacher')).toBe(false)
    expect(auth.can('admin')).toBe(false)
  })

  it('單一標籤只開通對應功能', () => {
    const auth = useAuthStore()
    auth.profile = profileWith(['parent'])
    expect(auth.can('parent')).toBe(true)
    expect(auth.can('teacher')).toBe(false)
    expect(auth.can('admin')).toBe(false)
    expect(auth.isAdmin).toBe(false)
  })

  it('邊際：admin 採嚴格逐標籤授權，不自動涵蓋老師/家長功能', () => {
    const auth = useAuthStore()
    auth.profile = profileWith(['admin'])
    expect(auth.isAdmin).toBe(true)
    expect(auth.can('admin')).toBe(true)
    expect(auth.can('teacher')).toBe(false) // 沒有老師標籤就不能點名
    expect(auth.can('parent')).toBe(false) // 沒有家長標籤就不能填出席
  })

  it('組長情境：同時具備三標籤 → 全功能開通', () => {
    const auth = useAuthStore()
    auth.profile = profileWith(['admin', 'teacher', 'parent'])
    expect(auth.can('admin')).toBe(true)
    expect(auth.can('teacher')).toBe(true)
    expect(auth.can('parent')).toBe(true)
  })

  it('審核制：未審核者即使具備標籤也無任何角色權限', () => {
    const auth = useAuthStore()
    auth.profile = profileWith(['admin', 'teacher', 'parent'], false)
    expect(auth.isApproved).toBe(false)
    expect(auth.isAdmin).toBe(false)
    expect(auth.can('admin')).toBe(false)
    expect(auth.can('teacher')).toBe(false)
    expect(auth.can('parent')).toBe(false)
  })

  it('邊際：空標籤陣列視同無任何權限', () => {
    const auth = useAuthStore()
    auth.profile = profileWith([])
    expect(auth.can('parent')).toBe(false)
    expect(auth.isAdmin).toBe(false)
  })
})
