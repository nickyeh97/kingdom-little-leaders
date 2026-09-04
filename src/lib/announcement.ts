/**
 * 公告日期的呈現（v11 #8）。
 *
 * 背景：師母回報「昨天發的公告卻顯示 7/28」。查證後那是一則 7/28 建立的舊公告
 * 被**編輯**（而非新發布），而 `announcements` 原本只有 `created_at`，
 * 所以畫面上的日期是「發布日」，編輯不會改動它。
 *
 * 決定：`created_at` 維持「發布日」語意不變（公告的時序是發布的先後），
 * 另外補 `updated_at` 並在畫面標示「已編輯」，讓兩者一目了然。
 */

/** 視為「同一次操作」的容差：建立當下的兩個時間戳可能差幾毫秒 */
const EDIT_THRESHOLD_MS = 60_000

export function wasEdited(createdAt: string, updatedAt?: string | null): boolean {
  if (!updatedAt) return false
  const created = Date.parse(createdAt)
  const updated = Date.parse(updatedAt)
  if (Number.isNaN(created) || Number.isNaN(updated)) return false
  return updated - created > EDIT_THRESHOLD_MS
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-TW')
}

/** 「2026/7/28」或「2026/7/28 · 2026/9/3 編輯」 */
export function announcementDateText(createdAt: string, updatedAt?: string | null): string {
  const base = fmt(createdAt)
  return wasEdited(createdAt, updatedAt) ? `${base} · ${fmt(updatedAt!)} 編輯` : base
}
