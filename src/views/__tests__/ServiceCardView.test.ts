// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Vant from 'vant'
import { createPinia, setActivePinia } from 'pinia'
import ServiceCardView from '../ServiceCardView.vue'
import { useAuthStore } from '../../stores/auth'
import type { Session } from '@supabase/supabase-js'
import type { BeastProfile, Child, ServiceCardEntry } from '../../types'

// 測試一律用假名
const kids: Child[] = [
  { id: 'k1', name: '小明', class_group_id: 'g1', service_eligible: true, level: null,
    class_groups: { id: 'g1', name: '兒童班', sort_order: 1 } },
  { id: 'k2', name: '小華', class_group_id: 'g2', service_eligible: false, level: null,
    class_groups: { id: 'g2', name: '幼童班', sort_order: 2 } },
]
let entries: ServiceCardEntry[] = []
let profile: BeastProfile | null = null
const saveEncouragements = vi.fn()

vi.mock('../../api/attendance', () => ({ listMyChildren: () => Promise.resolve(kids) }))
vi.mock('../../api/childService', () => ({
  listChildServiceItems: () =>
    Promise.resolve([
      { id: 'i1', name: '奉獻服事長', description: '', sort_order: 1, active: true },
      { id: 'i2', name: '敬拜-司琴', description: '', sort_order: 2, active: true },
    ]),
}))
vi.mock('../../api/serviceCard', () => ({
  listServiceCardEntries: () => Promise.resolve(entries),
  getBeastProfile: () => Promise.resolve(profile),
  deleteServiceCardEntry: vi.fn(),
  saveEncouragements: (...a: unknown[]) => saveEncouragements(...a),
}))

function entry(id: string, item: string, by: string): ServiceCardEntry {
  return { id, child_id: 'k1', item, fruit: id === 'e1' ? '喜樂' : null, recorded_by: by,
    created_at: '2026-10-24T16:30:00Z' }
}

async function mountPage() {
  const auth = useAuthStore()
  auth.session = { user: { id: 'me', email: 'a@b.c' } } as unknown as Session
  const w = mount(ServiceCardView, { global: { plugins: [Vant] } })
  await flushPromises()
  return w
}

describe('家長的服事卡頁（小領袖靈獸）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    entries = []
    profile = null
    saveEncouragements.mockReset()
  })

  it('只列兒童班的孩子（幼童班暫不開放），一位孩子時不出現切換分頁', async () => {
    const w = await mountPage()
    expect(w.text()).not.toContain('小華')
    expect(w.find('.van-tabs').exists()).toBe(false)
  })

  it('服事卡：等級＝次數＋1、沒服事過顯示等你來探索；不顯示還差幾次', async () => {
    entries = [entry('e1', '奉獻服事長', 'me'), entry('e2', '奉獻服事長', 'someone')]
    const w = await mountPage()
    expect(w.text()).toContain('3 等')
    expect(w.text()).toContain('等你來探索')
    expect(w.text()).toContain('「初生」')
    expect(w.text()).not.toMatch(/還差|距離|下一階段/)
  })

  it('紀錄：只有自己登錄的那筆有刪除鈕；日期用台灣時間、附果子', async () => {
    entries = [entry('e1', '奉獻服事長', 'me'), entry('e2', '敬拜-司琴', 'someone')]
    const w = await mountPage()
    expect(w.findAll('button').filter((b) => b.text() === '刪除')).toHaveLength(1)
    expect(w.text()).toContain('2026/10/25')
    expect(w.text()).toContain('喜樂')
  })

  it('還沒選靈獸：不能寫鼓勵話，只顯示說明', async () => {
    const w = await mountPage()
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.text()).toContain('選好自己的靈獸之後')
  })

  it('鼓勵話：超過 5 句不存；合格就存整理過的句子', async () => {
    profile = { child_id: 'k1', variant: 'lamb', palette: 'p1', encouragements: ['謝謝你'] }
    const w = await mountPage()
    const ta = w.find('textarea')
    expect((ta.element as HTMLTextAreaElement).value).toBe('謝謝你')
    await ta.setValue('1\n2\n3\n4\n5\n6')
    await w.findAll('button').find((b) => b.text() === '存好')!.trigger('click')
    expect(saveEncouragements).not.toHaveBeenCalled()
    await ta.setValue(' 你好認真 \n\n謝謝你')
    await w.findAll('button').find((b) => b.text() === '存好')!.trigger('click')
    expect(saveEncouragements).toHaveBeenCalledWith('k1', ['你好認真', '謝謝你'])
  })
})
