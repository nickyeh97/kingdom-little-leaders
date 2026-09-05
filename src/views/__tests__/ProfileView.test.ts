// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Vant from 'vant'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProfileView from '../ProfileView.vue'
import { useAuthStore } from '../../stores/auth'
import type { Profile, UserRole } from '../../types'
import type { Session } from '@supabase/supabase-js'

const Empty = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/me', name: 'me', component: Empty },
      { path: '/vision', name: 'vision', component: Empty },
      { path: '/org', name: 'org', component: Empty },
      { path: '/child-service-items', name: 'child-service-items', component: Empty },
      { path: '/my-lessons', name: 'my-lessons', component: Empty },
      { path: '/members', name: 'members', component: Empty },
      { path: '/lesson-plans', name: 'lesson-plans', component: Empty },
      { path: '/class-info', name: 'class-info', component: Empty },
      { path: '/materials', name: 'materials', component: Empty },
      { path: '/meetings', name: 'meetings', component: Empty },
      { path: '/records', name: 'records', component: Empty },
      { path: '/class-log', name: 'class-log', component: Empty },
    ],
  })
}

function loginAs(roles: UserRole[], approved = true) {
  const auth = useAuthStore()
  auth.session = { user: { id: 'u1', email: 'a@b.c' } } as unknown as Session
  auth.profile = {
    id: 'u1',
    display_name: '測試使用者',
    roles,
    approved,
    auth_provider: 'email',
    phone: null,
    created_at: '2026-09-04T00:00:00Z',
  } satisfies Profile
}

async function mountMe() {
  const router = makeRouter()
  await router.push('/me')
  await router.isReady()
  return mount(ProfileView, { global: { plugins: [Vant, router] } })
}

describe('「我的」選單入口（權限修正）', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('兒童服事項目：所有已審核成員都看得到，不分角色與班別', async () => {
    for (const roles of [['parent'], ['teacher'], ['admin'], ['teacher', 'admin']] as UserRole[][]) {
      setActivePinia(createPinia())
      loginAs(roles)
      const w = await mountMe()
      expect(w.text(), `角色 ${roles.join('/')} 應看得到兒童服事項目`).toContain('兒童服事項目')
    }
  })

  it('兒童服事項目在「關於兒童牧區」區，不在「我的孩子」區', async () => {
    loginAs(['teacher'])
    const w = await mountMe()
    // 純老師沒有家長標籤，「我的孩子」整區不出現，但兒童服事項目仍在
    expect(w.text()).toContain('關於兒童牧區')
    expect(w.text()).not.toContain('我的孩子')
    expect(w.text()).toContain('兒童服事項目')
  })

  it('邊際：未審核者看不到兒童服事項目與組織架構，只剩異象', async () => {
    loginAs(['parent'], false)
    const w = await mountMe()
    expect(w.text()).toContain('國度領袖兒童異象')
    expect(w.text()).not.toContain('兒童服事項目')
    expect(w.text()).not.toContain('組織架構與分工')
  })

  it('「孩子上過的課程」仍限家長標籤', async () => {
    loginAs(['parent'])
    expect((await mountMe()).text()).toContain('孩子上過的課程')
    setActivePinia(createPinia())
    loginAs(['teacher', 'admin'])
    expect((await mountMe()).text()).not.toContain('孩子上過的課程')
  })

  it('名單與權限仍限同工標籤', async () => {
    loginAs(['admin'])
    expect((await mountMe()).text()).toContain('名單與權限')
    setActivePinia(createPinia())
    loginAs(['parent', 'teacher'])
    expect((await mountMe()).text()).not.toContain('名單與權限')
  })
})
