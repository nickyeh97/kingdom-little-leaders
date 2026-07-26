/**
 * 聚會日程設定。
 * 本教會主日聚會目前於「週六下午」舉行，且不強制固定週幾——
 * 因此聚會日是設定值而非寫死的常數語意，未來可改為後台（資料庫）設定。
 */

/** 聚會日（0=週日、1=週一 ⋯ 6=週六）。目前：週六 */
export const GATHERING_WEEKDAY = 6

/** 預先出席截止：聚會日前 N 天的 23:59:59。目前：前 1 天（週六聚會 → 週五截止） */
export const PLAN_DEADLINE_DAYS_BEFORE = 1

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] as const
