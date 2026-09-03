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
