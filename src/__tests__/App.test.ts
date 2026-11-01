// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

async function mountApp() {
  vi.resetModules()
  const App = (await import('../App.vue')).default
  return mount(App, { global: { stubs: ['router-view'] } })
}

describe('測試資料庫提示列', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('npm run dev:staging（mode=staging）時顯示連到哪個資料庫', async () => {
    vi.stubEnv('MODE', 'staging')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-ref.supabase.co')
    expect((await mountApp()).text()).toContain('測試資料庫：test-ref.supabase.co')
  })

  it('邊際：正式建置與一般開發不顯示', async () => {
    vi.stubEnv('MODE', 'production')
    expect((await mountApp()).find('.staging-banner').exists()).toBe(false)
  })
})
