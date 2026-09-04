// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { useAuthStore } from '../../stores/auth'
import type { Profile, UserRole } from '../../types'
import type { Session } from '@supabase/supabase-js'

function loginAs(roles: UserRole[], approved = true) {
  const auth = useAuthStore()
  auth.session = { user: { id: 'u1' } } as unknown as Session
  auth.profile = {
    id: 'u1',
    display_name: '測試使用者',
    roles,
    approved,
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

  it('詩歌頁：任何已登入角色皆可進入', async () => {
    loginAs(['parent'])
    await router.push({ name: 'songs' })
    expect(router.currentRoute.value.name).toBe('songs')
  })

  it('審核制：未審核者即使有標籤也僅能停留首頁與我的', async () => {
    loginAs(['parent', 'teacher'], false)
    for (const name of ['attendance', 'checkin', 'songs', 'members'] as const) {
      await router.push({ name })
      expect(router.currentRoute.value.name).toBe('home')
    }
    await router.push({ name: 'me' })
    expect(router.currentRoute.value.name).toBe('me')
  })

  it('換頁一律回到頁面頂端（v9 #8）', () => {
    // 手機從下方分頁切換時若沿用捲動位置，會看不到上方內容
    const behavior = router.options.scrollBehavior
    expect(behavior).toBeTypeOf('function')
    expect(behavior?.({} as never, {} as never, null)).toEqual({ top: 0 })
  })

  it('異象頁：全員可看——未審核的新成員也進得去（v8 #1）', async () => {
    loginAs(['parent'], false)
    await router.push({ name: 'vision' })
    expect(router.currentRoute.value.name).toBe('vision')
  })

  it('邊際：未登入者仍看不到異象頁 → 導向登入頁', async () => {
    await router.push({ name: 'vision' })
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('組織架構頁：家長也進得去（v10 #1）——老師名單由 RPC 依角色過濾', async () => {
    loginAs(['parent'])
    await router.push({ name: 'org' })
    expect(router.currentRoute.value.name).toBe('org')
  })

  it('邊際：未審核者仍進不了組織架構頁', async () => {
    loginAs(['parent'], false)
    await router.push({ name: 'org' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('孩子上過的課程：家長可進（v10 #2）', async () => {
    loginAs(['parent'])
    await router.push({ name: 'my-lessons' })
    expect(router.currentRoute.value.name).toBe('my-lessons')
  })

  it('邊際：沒有家長標籤的老師/同工進不了「孩子上過的課程」', async () => {
    loginAs(['teacher', 'admin'])
    await router.push({ name: 'my-lessons' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('家長不可進老師端教案頁（v11 #2：避免覆蓋老師的教案）', async () => {
    // 家長只走唯讀的 my-lessons；教案的寫入權在 RLS 也只給 admin 與該班老師
    loginAs(['parent'])
    await router.push({ name: 'lesson-plans' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('兒童服事項目：老師與家長都進得去（編輯權另由 RLS 只給同工；v11 #4）', async () => {
    loginAs(['parent'])
    await router.push({ name: 'child-service-items' })
    expect(router.currentRoute.value.name).toBe('child-service-items')
  })

  it('邊際：未審核者進不了兒童服事項目', async () => {
    loginAs(['teacher'], false)
    await router.push({ name: 'child-service-items' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('組長情境：三標籤齊全可進所有頁面', async () => {
    loginAs(['admin', 'teacher', 'parent'])
    for (const name of ['attendance', 'checkin', 'songs', 'members', 'org', 'my-lessons', 'me'] as const) {
      await router.push({ name })
      expect(router.currentRoute.value.name).toBe(name)
    }
  })
})
