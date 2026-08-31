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
 * 首頁提醒用：上堂課「有上課、但還沒填課堂紀錄」的班別（v9 驗收回饋 2026-08-31 修訂）。
 *
 * - 有點名紀錄＝那天有上課（沿用「有點名動作」作為有上課的代理判斷，CLAUDE.md 決議 2）
 * - 同班只要有人填了就算填過，不必每位老師各填一份
 * - **不看是誰點的名**：只要沒填，同工與該班老師都該被提醒（不是只有按點名的那個人）
 *
 * `canSee(classGroupId)` 由呼叫端決定誰看得到：同工看全部班別，老師看自己被指派的班。
 */
export function classesMissingLog(
  checks: { class_group_id: string }[],
  logs: { class_group_id: string }[],
  canSee: (classGroupId: string) => boolean,
): string[] {
  const logged = new Set(logs.map((l) => l.class_group_id))
  const missing: string[] = []
  for (const c of checks) {
    if (logged.has(c.class_group_id)) continue
    if (!canSee(c.class_group_id)) continue
    if (!missing.includes(c.class_group_id)) missing.push(c.class_group_id)
  }
  return missing
}
