/**
 * 服事排班（Sprint 04 Wave 1a）。
 * 服事項目字典：v7 反饋 #4（2026-08-28 定案）——全主責/助教（敬拜）/助教（真理）/助理/彈性時間；
 * 報名與排班一致。item 以文字儲存，既有紀錄不受影響，仍可自行輸入其他項目。
 */
export const SERVICE_ITEM_PRESETS = [
  '全主責',
  '助教（敬拜）',
  '助教（真理）',
  '助理',
  '彈性時間',
]

/** 服事報名開放範圍：未來 N 次聚會（v9 #9：8 → 12） */
export const SIGNUP_WEEKS_AHEAD = 12

/**
 * 兒童服事項目（v6 反饋 #6，2026-08-27 定案的六項）。
 * v11 #4 起改由 `child_service_items` 資料表維護，這裡只留作**後備**：
 * 資料表讀不到（migration 尚未執行）時，畫面仍有可用的項目而不是空白。
 */
export const CHILD_SERVICE_ITEM_PRESETS = [
  '收奉獻',
  '敬拜-司琴',
  '敬拜-小樂器',
  '敬拜-Vocal',
  '領讀天使-宣言/讀經/禱告',
  '環境稽核',
]

/**
 * 勾選按鈕要顯示的項目（v11 #4）。
 * 啟用中的字典項目排前面，後面接「已授權但不在字典裡」的舊項目——
 * 那些項目仍要看得到，同工才取消得掉（停用或改名不會讓既有授權變成孤兒）。
 */
export function childServiceItemOptions(
  items: { name: string; active: boolean }[],
  granted: string[],
): string[] {
  const base = items.length > 0 ? items.filter((i) => i.active).map((i) => i.name) : CHILD_SERVICE_ITEM_PRESETS
  const seen = new Set(base)
  return [...base, ...granted.filter((g) => !seen.has(g))]
}

// ---- 老師服事總覽表（v11 #10）----
// 同工排班時要一眼看出「上週誰排過、這週該換誰」，逐列文字看不出來，
// 改成「四類為欄、聚會日為列」的表。

/** 表頭四欄（2026-09-03 同工需求；助教（敬拜）與助教（真理）都併入「助教」） */
export const SERVICE_COLUMNS = ['全主責', '助教', '助理', '彈性時間'] as const
export type ServiceColumn = (typeof SERVICE_COLUMNS)[number]

/**
 * 報名項目歸到哪一欄；不屬於四類的回 null（呼叫端另外列出，不硬塞）。
 * 用 includes 而非 startsWith：v7 之前的紀錄存的是「主責」而不是「全主責」，
 * 舊資料也要歸得了欄，否則整欄空白、同工看不出誰排過。
 */
export function serviceColumnOf(item: string): ServiceColumn | null {
  const name = (item ?? '').trim()
  if (!name) return null
  if (name.includes('助教')) return '助教'
  if (name.includes('助理')) return '助理'
  if (name.includes('主責')) return '全主責'
  if (name.includes('彈性時間')) return '彈性時間'
  return null
}

/** 「助教（敬拜）」在助教欄顯示成「小美（敬拜）」——保留括號裡的分工才看得出差別 */
function cellLabel(teacherName: string, item: string): string {
  const m = item.match(/[（(]([^）)]+)[）)]/)
  return m ? `${teacherName}（${m[1]}）` : teacherName
}

export interface ServiceGridRow {
  date: string
  /** 四欄各自的人名（可多人） */
  cells: Record<ServiceColumn, string[]>
  /** 不屬於四類的報名，原樣保留（「項目·人名」） */
  others: string[]
}

export function serviceGrid(
  dates: string[],
  signups: { gathering_date: string; teacher_name: string; item: string }[],
): ServiceGridRow[] {
  return dates.map((date) => {
    const cells = Object.fromEntries(SERVICE_COLUMNS.map((c) => [c, [] as string[]])) as Record<
      ServiceColumn,
      string[]
    >
    const others: string[] = []
    for (const sg of signups) {
      if (sg.gathering_date !== date) continue
      const col = serviceColumnOf(sg.item)
      if (col) cells[col].push(cellLabel(sg.teacher_name, sg.item))
      else others.push(`${sg.item}·${sg.teacher_name}`)
    }
    return { date, cells, others }
  })
}
