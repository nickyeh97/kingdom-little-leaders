/**
 * 教學模組（Sprint 04 Wave 2）。
 * 教案項目選項源自現行共編 Excel 的流程段落；僅為建議、可自由輸入。
 * 教材庫為外連型（v4 裁決 A）：檔案放教會 NAS/雲端，平台存連結＋目錄。
 * 教案/流程/要點/教材庫皆不含幼幼班（權限矩陣）。
 */
export const LESSON_ITEM_PRESETS = [
  '組別分工服事',
  '破冰',
  '敬拜',
  '收奉獻＋禱告',
  '信息',
  '遊戲/活動',
  '背金句',
  '結束禱告',
  '彈性時間',
  '環境整理',
]

export const MATERIAL_CATEGORY_PRESETS = ['影片', 'PPT', '講義', '學習單', '其他']

/**
 * 首頁提醒用：上堂課「我點過名、但該班還沒填課堂紀錄」的班別（v9 驗收回饋）。
 * 只看班別層級——同班只要有人填了就算填過（不必每位老師各填一份）。
 * 回傳班別 id（保持點名出現順序），呼叫端再轉成班名顯示，讓提醒講得出是哪一班。
 */
export function classesMissingLog(
  checks: { class_group_id: string; checked_by: string }[],
  logs: { class_group_id: string }[],
  meId: string | undefined,
): string[] {
  if (!meId) return []
  const logged = new Set(logs.map((l) => l.class_group_id))
  const mine: string[] = []
  for (const c of checks) {
    if (c.checked_by !== meId) continue
    if (logged.has(c.class_group_id)) continue
    if (!mine.includes(c.class_group_id)) mine.push(c.class_group_id)
  }
  return mine
}
