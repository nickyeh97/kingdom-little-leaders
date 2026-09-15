import { describe, expect, it } from 'vitest'
import { attendingByClass, attendingSummary, topicAt, topicIndex } from '../serviceTopic'
import type { AttendancePlan, Child, ClassGroup, ClassTopic } from '../../types'

function topic(p: Partial<ClassTopic> = {}): ClassTopic {
  return {
    id: 't1',
    gathering_date: '2026-10-03',
    class_group_id: 'kid',
    topic: '品格週-分享',
    updated_by_name: '小美老師',
    updated_at: '2026-09-15T00:00:00Z',
    ...p,
  }
}

const groups: ClassGroup[] = [
  { id: 'kid', name: '兒童班' },
  { id: 'tod', name: '幼童班' },
  { id: 'baby', name: '幼幼班' },
] as ClassGroup[]

const children: Child[] = [
  { id: 'c1', class_group_id: 'kid' },
  { id: 'c2', class_group_id: 'kid' },
  { id: 'c3', class_group_id: 'tod' },
  { id: 'c4', class_group_id: 'baby' },
] as Child[]

function plan(p: Partial<AttendancePlan>): AttendancePlan {
  return {
    id: 'p',
    child_id: 'c1',
    gathering_date: '2026-10-03',
    status: 'attending',
    note: null,
    updated_by: 'u1',
    ...p,
  } as AttendancePlan
}

describe('預排主題（v16 #1）', () => {
  it('依「聚會日｜班別」查得到主題', () => {
    const idx = topicIndex([topic(), topic({ id: 't2', class_group_id: 'tod', topic: '油瓶不斷' })])
    expect(topicAt(idx, '2026-10-03', 'kid')).toBe('品格週-分享')
    expect(topicAt(idx, '2026-10-03', 'tod')).toBe('油瓶不斷')
  })

  it('沒排主題的日期／班別回空字串，讓畫面整行不顯示', () => {
    const idx = topicIndex([topic()])
    expect(topicAt(idx, '2026-10-10', 'kid')).toBe('')
    expect(topicAt(idx, '2026-10-03', 'baby')).toBe('')
  })

  it('只有空白的主題等同沒排——不佔一行版面', () => {
    const idx = topicIndex([topic({ topic: '   ' }), topic({ id: 't2', class_group_id: 'tod', topic: '' })])
    expect(topicAt(idx, '2026-10-03', 'kid')).toBe('')
    expect(topicAt(idx, '2026-10-03', 'tod')).toBe('')
  })

  it('前後空白會被修掉', () => {
    const idx = topicIndex([topic({ topic: '  品格週-合作  ' })])
    expect(topicAt(idx, '2026-10-03', 'kid')).toBe('品格週-合作')
  })
})

describe('預計出席人數（v16 #2）', () => {
  it('只算「出席」，請假與未定都不算', () => {
    const plans = [
      plan({ id: 'p1', child_id: 'c1', status: 'attending' }),
      plan({ id: 'p2', child_id: 'c2', status: 'leave' }),
      plan({ id: 'p3', child_id: 'c3', status: 'attending' }),
      plan({ id: 'p4', child_id: 'c4', status: 'undecided' }),
    ]
    const counts = attendingByClass(plans, children, groups, '2026-10-03')
    expect(counts).toEqual([
      { class_group_id: 'kid', name: '兒童班', attending: 1 },
      { class_group_id: 'tod', name: '幼童班', attending: 1 },
    ])
  })

  it('只算指定那一天，別天的不混進來', () => {
    const plans = [
      plan({ id: 'p1', child_id: 'c1', gathering_date: '2026-10-03' }),
      plan({ id: 'p2', child_id: 'c2', gathering_date: '2026-10-10' }),
    ]
    expect(attendingByClass(plans, children, groups, '2026-10-03')).toEqual([
      { class_group_id: 'kid', name: '兒童班', attending: 1 },
    ])
  })

  it('掛零的班別不列出——免得卡片上一排「0 人」的雜訊', () => {
    const plans = [plan({ id: 'p1', child_id: 'c3' })]
    const counts = attendingByClass(plans, children, groups, '2026-10-03')
    expect(counts.map((c) => c.name)).toEqual(['幼童班'])
  })

  it('照班別的既有順序，不會今天兒童班在前明天幼童班在前', () => {
    const plans = [plan({ id: 'p1', child_id: 'c3' }), plan({ id: 'p2', child_id: 'c1' })]
    expect(attendingByClass(plans, children, groups, '2026-10-03').map((c) => c.name)).toEqual([
      '兒童班',
      '幼童班',
    ])
  })

  it('邊際：找不到孩子（已刪除或看不到）就跳過，不猜班別', () => {
    const plans = [plan({ id: 'p1', child_id: '不存在' }), plan({ id: 'p2', child_id: 'c1' })]
    expect(attendingByClass(plans, children, groups, '2026-10-03')).toEqual([
      { class_group_id: 'kid', name: '兒童班', attending: 1 },
    ])
  })

  it('邊際：class_group_id 是數字型別也對得起來（歷史遺留的型別）', () => {
    const numGroups = [{ id: '1', name: '兒童班' }] as ClassGroup[]
    const numChildren = [{ id: 'c1', class_group_id: 1 }] as unknown as Child[]
    expect(attendingByClass([plan({ child_id: 'c1' })], numChildren, numGroups, '2026-10-03')).toEqual(
      [{ class_group_id: '1', name: '兒童班', attending: 1 }],
    )
  })

  it('提示列文字；全都沒人填就回空字串讓整行不顯示', () => {
    expect(
      attendingSummary([
        { class_group_id: 'kid', name: '兒童班', attending: 10 },
        { class_group_id: 'tod', name: '幼童班', attending: 5 },
      ]),
    ).toBe('兒童班 10、幼童班 5')
    expect(attendingSummary([])).toBe('')
  })
})
