/**
 * 會議系統（C-05）：事項狀態追蹤（待辦/進行中/已完成）。
 */
export type MeetingItemStatus = 'todo' | 'doing' | 'done'

export const MEETING_STATUS: {
  value: MeetingItemStatus
  label: string
  tagType: 'warning' | 'primary' | 'success'
}[] = [
  { value: 'todo', label: '待辦', tagType: 'warning' },
  { value: 'doing', label: '進行中', tagType: 'primary' },
  { value: 'done', label: '已完成', tagType: 'success' },
]

export function statusMeta(status: MeetingItemStatus) {
  return MEETING_STATUS.find((s) => s.value === status) ?? MEETING_STATUS[0]
}

/** 點一下循環切換狀態：待辦 → 進行中 → 已完成 → 待辦 */
export function nextStatus(status: MeetingItemStatus): MeetingItemStatus {
  const order: MeetingItemStatus[] = ['todo', 'doing', 'done']
  return order[(order.indexOf(status) + 1) % order.length]
}
