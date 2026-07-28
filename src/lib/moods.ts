/**
 * 課堂表現表情選項（取代成績，向家長說明孩子的課堂情況）。
 * 設計原則（docs/DESIGN_PRINCIPLES.md 紅燈 #7）：
 * 一律正向或關懷取向，不得出現羞辱性、負面標籤的選項；
 * 「需要多關心」類選項的目的是提醒關懷，不是指責。
 */
export interface MoodOption {
  emoji: string
  label: string
}

export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '🎯', label: '專心投入' },
  { emoji: '🙋', label: '踴躍發言' },
  { emoji: '😊', label: '喜樂滿滿' },
  { emoji: '🤝', label: '幫助同學' },
  { emoji: '🙏', label: '有禮貌' },
  { emoji: '🎵', label: '敬拜投入' },
  { emoji: '📖', label: '金句達人' },
  { emoji: '💪', label: '勇敢嘗試' },
  { emoji: '🌱', label: '持續進步' },
  { emoji: '⚡', label: '活力充沛' },
  { emoji: '🎨', label: '創意滿點' },
  { emoji: '😴', label: '今天有點累' },
  { emoji: '🥺', label: '想念爸媽' },
  { emoji: '🫂', label: '需要多關心' },
]

/** moods 欄位存「emoji label」字串，顯示時直接使用 */
export function moodKey(m: MoodOption): string {
  return `${m.emoji} ${m.label}`
}
