// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { useAuthStore } from '../../stores/auth'
import type { Profile, UserRole } from '../../types'
import type { Session } from '@supabase/supabase-js'

function loginAs(roles: UserRole[]) {
  const auth = useAuthStore()
  auth.session = { user: { id: 'u1' } } as unknown as Session
  auth.profile = {
    id: 'u1',
    display_name: '測試使用者',
    roles,
    auth_provider: 'email',
    phone: null,
    created_at: '2026-07-26T00:00:00Z',
  } satisfies Profile
}

describe('路由守衛：登入與標籤式授權', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    // 每次從登入頁重新出發，避免前一測試的路由狀態殘留
    await router.replace({ name: 'login' }).catch(() => {})
  })

  it('未登入者進入任何受保護頁面 → 導向登入頁', async () => {
    await router.push({ name: 'home' })
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('已登入者再訪登入頁 → 導向首頁', async () => {
    loginAs(['parent'])
    await router.push({ name: 'home' })
    // 已登入狀態下嘗試回登入頁，應被守衛擋回首頁
    await router.push({ name: 'login' }).catch(() => {})
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('家長標籤可進出席頁、不可進點名頁', async () => {
    loginAs(['parent'])
    await router.push({ name: 'attendance' })
    expect(router.currentRoute.value.name).toBe('attendance')
    await router.push({ name: 'checkin' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('老師標籤可進點名頁、不可進出席頁', async () => {
    loginAs(['teacher'])
    await router.push({ name: 'checkin' })
    expect(router.currentRoute.value.name).toBe('checkin')
    await router.push({ name: 'attendance' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('邊際：純 admin 標籤可進名單頁，但不可進點名/出席頁（逐標籤授權）', async () => {
    loginAs(['admin'])
    await router.push({ name: 'members' })
    expect(router.currentRoute.value.name).toBe('members')
    await router.push({ name: 'checkin' })
    expect(router.currentRoute.value.name).toBe('home')
    await router.push({ name: 'attendance' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('邊際：非 admin 不可進名單頁', async () => {
    loginAs(['teacher', 'parent'])
    await router.push({ name: 'members' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('組長情境：三標籤齊全可進所有頁面', async () => {
    loginAs(['admin', 'teacher', 'parent'])
    for (const name of ['attendance', 'checkin', 'members', 'me'] as const) {
      await router.push({ name })
      expect(router.currentRoute.value.name).toBe(name)
    }
  })
})
