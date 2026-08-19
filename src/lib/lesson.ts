/**
 * 教案時間工具（run sheet）。
 * time_text 沿用現行共編 Excel 的自由格式（如「5分鐘 1400-1405」），
 * 這裡提供解析／組合，讓填寫端用「分鐘數＋開始時間」兩欄自動產生，
 * 呈現端拆回大字分鐘數與起訖區間；亦相容手填的舊格式。
 */
export interface ParsedTime {
  minutes: number | null
  start: string // HH:MM，無法解析時為 ''
  end: string
}

/** 「1400」「930」「14:00」→「14:00」；無法解析回傳 '' */
export function normalizeClock(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):?(\d{2})$/)
  if (!m) return ''
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function addToClock(hhmm: string, minutes: number): string {
  const t = normalizeClock(hhmm)
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function parseTimeText(text: string): ParsedTime {
  const minMatch = text.match(/(\d+)\s*分/)
  const minutes = minMatch ? Number(minMatch[1]) : null
  // 移除「X分鐘」後找起訖時刻（相容 1400-1405 / 14:00~14:05 / 僅起始）
  const rest = text.replace(/\d+\s*分鐘?/, ' ')
  const clocks = [...rest.matchAll(/(\d{1,2}:\d{2}|\d{3,4})/g)]
    .map((m) => normalizeClock(m[1]))
    .filter(Boolean)
  const start = clocks[0] ?? ''
  let end = clocks[1] ?? ''
  if (!end && start && minutes != null) end = addToClock(start, minutes)
  return { minutes, start, end }
}

/** 由「分鐘數＋開始時間」組合 time_text（沿用 Excel 慣用格式） */
export function composeTimeText(minutes: number | null, start: string): string {
  const s = normalizeClock(start)
  if (minutes != null && s) return `${minutes}分鐘 ${s}-${addToClock(s, minutes)}`
  if (minutes != null) return `${minutes}分鐘`
  return s
}

/** 總時長（分）：加總可解析的分鐘數 */
export function totalMinutes(texts: string[]): number {
  return texts.reduce((sum, t) => sum + (parseTimeText(t).minutes ?? 0), 0)
}

/** 標準流程範本（源自現行共編 Excel 常見段落；一鍵建立後再改內容） */
export const LESSON_TEMPLATE: { minutes: number; item: string }[] = [
  { minutes: 5, item: '組別分工服事' },
  { minutes: 10, item: '破冰' },
  { minutes: 10, item: '敬拜' },
  { minutes: 5, item: '收奉獻＋禱告' },
  { minutes: 30, item: '信息' },
  { minutes: 20, item: '遊戲/活動' },
  { minutes: 5, item: '背金句' },
  { minutes: 5, item: '結束禱告' },
  { minutes: 10, item: '彈性時間' },
]

/** 預設開課時間（週六下午；可於範本建立後自行調整） */
export const LESSON_DEFAULT_START = '14:00'
