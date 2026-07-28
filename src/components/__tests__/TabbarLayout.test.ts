// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import TabbarLayout from '../TabbarLayout.vue'
import { useAuthStore } from '../../stores/auth'
import type { UserRole } from '../../types'

const Empty = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Empty },
      { path: '/attendance', name: 'attendance', component: Empty },
      { path: '/checkin', name: 'checkin', component: Empty },
      { path: '/members', name: 'members', component: Empty },
      { path: '/me', name: 'me', component: Empty },
    ],
  })
}

async function mountWithRoles(roles: UserRole[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.profile = {
    id: 'u1',
    display_name: '測試使用者',
    roles,
    auth_provider: 'email',
    phone: null,
    created_at: '2026-07-26T00:00:00Z',
  }
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  return mount(TabbarLayout, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterView: Empty,
        'van-tabbar': { template: '<nav><slot /></nav>' },
        'van-tabbar-item': { template: '<span class="tab"><slot /></span>' },
      },
    },
  })
}

function tabLabels(wrapper: Awaited<ReturnType<typeof mountWithRoles>>) {
  return wrapper.findAll('.tab').map((t) => t.text())
}

describe('TabbarLayout：分頁依角色標籤顯示', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('家長標籤：首頁／出席／我的', async () => {
    const w = await mountWithRoles(['parent'])
    expect(tabLabels(w)).toEqual(['首頁', '出席', '我的'])
  })

  it('老師標籤：首頁／點名／我的', async () => {
    const w = await mountWithRoles(['teacher'])
    expect(tabLabels(w)).toEqual(['首頁', '點名', '我的'])
  })

  it('邊際：純 admin 只多出名單，不含點名/出席（逐標籤授權）', async () => {
    const w = await mountWithRoles(['admin'])
    expect(tabLabels(w)).toEqual(['首頁', '名單', '我的'])
  })

  it('組長（三標籤）：五個分頁全開', async () => {
    const w = await mountWithRoles(['admin', 'teacher', 'parent'])
    expect(tabLabels(w)).toEqual(['首頁', '出席', '點名', '名單', '我的'])
  })

  it('邊際：無任何標籤仍保有首頁與我的', async () => {
    const w = await mountWithRoles([])
    expect(tabLabels(w)).toEqual(['首頁', '我的'])
  })
})
