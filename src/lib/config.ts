/**
 * 聚會日程設定。
 * 本教會的聚會目前於「週六下午」舉行，且不強制固定週幾——
 * 因此聚會日是設定值而非寫死的常數語意，未來可改為後台（資料庫）設定。
 */

/** 聚會日（0=週日、1=週一 ⋯ 6=週六）。目前：週六 */
export const GATHERING_WEEKDAY = 6

/** 預先出席截止：聚會日前 N 天的 23:59:59。目前：前 1 天（週六聚會 → 週五截止） */
export const PLAN_DEADLINE_DAYS_BEFORE = 1

/**
 * 單次改期：「原定聚會日 → 實際聚會日」（YYYY-MM-DD）。
 * 遇到園遊會等特殊活動時加一筆即可（不限週末，如週六 → 下週二國定假日；可往前/往後、可超過一週），出席行事曆、點名、截止時間、歌單日期都會跟著改；
 * 截止時間依實際聚會日重算（仍是前 PLAN_DEADLINE_DAYS_BEFORE 天）。活動過後可留著當紀錄。
 */
export const GATHERING_OVERRIDES: Readonly<Record<string, string>> = {
  '2026-12-05': '2026-12-06', // 12/5 園遊會，該週聚會改到 12/6
}

/** 老師課後反饋填寫期限：上完課後 N 天內（當天起算，含當天，至第 N 天 23:59:59） */
export const FEEDBACK_DUE_DAYS = 2

/** 出席紀錄查詢範圍：近 N 個月 */
export const RECORDS_MONTHS = 6

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] as const
