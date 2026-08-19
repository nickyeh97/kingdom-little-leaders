import { describe, expect, it } from 'vitest'
import { MEETING_STATUS, nextStatus, statusMeta } from '../meeting'

describe('會議事項狀態', () => {
  it('三種狀態：待辦/進行中/已完成', () => {
    expect(MEETING_STATUS.map((s) => s.value)).toEqual(['todo', 'doing', 'done'])
    expect(statusMeta('doing').label).toBe('進行中')
  })

  it('nextStatus 循環切換', () => {
    expect(nextStatus('todo')).toBe('doing')
    expect(nextStatus('doing')).toBe('done')
    expect(nextStatus('done')).toBe('todo')
  })
})
