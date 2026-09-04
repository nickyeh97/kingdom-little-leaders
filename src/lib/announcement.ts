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

// ---- 公告分類（v0.3.2）----
// 給家長辨識「這則是行政通知還是跟上課有關」。
// 沿用既有 tag 欄位改變語意（原為公告/重要），而不是再加一個標籤欄位——
// 卡片上已有「班別」標籤，第三個標籤會把標題擠到換行。
// 醒目度由既有的置頂（📌）承擔，不另設「重要」。

export const ANNOUNCEMENT_CATEGORIES = ['行政', '課程'] as const
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

export const CATEGORY_DEFAULT: AnnouncementCategory = '行政'

/** 篩選 chip 的「全部」值；用空字串而非 null，方便直接綁 v-model */
export const CATEGORY_ALL = ''

/**
 * 舊值相容（v0.3.2）：資料庫在 migration 執行前仍是「公告／重要」。
 * 部署與 migration 不會同時完成，這段空窗若不轉換，篩選 chip 會篩不到任何東西。
 * 對應規則與 migration 一致：重要（多為課堂提醒）→ 課程，其餘 → 行政。
 */
export function normalizeCategory(tag: string | null | undefined): AnnouncementCategory {
  const v = (tag ?? '').trim()
  if (isCategory(v)) return v
  return v === '重要' ? '課程' : CATEGORY_DEFAULT
}

export function isCategory(v: string): v is AnnouncementCategory {
  return (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(v)
}

/** 卡片標籤樣式：行政＝橘、課程＝綠（與班別標籤的藍/橘/綠 soft 底同一套語彙但不同色相） */
export function categoryStyle(tag: string) {
  return tag === '課程'
    ? { background: 'var(--kll-green-soft)', color: 'var(--kll-green-text)', border: 'none' }
    : { background: 'var(--kll-orange-soft)', color: 'var(--kll-orange-text)', border: 'none' }
}

/** 分類前綴的小圖示，讓家長不必讀字也分得出來 */
export function categoryIcon(tag: string): string {
  return tag === '課程' ? '📖' : '🏛'
}

/**
 * 依分類篩選；空字串＝全部。
 * 不改變排序——公告是時序內容，置頂與時間先後的規則保持不變。
 */
export function filterByCategory<T extends { tag: string }>(list: T[], category: string): T[] {
  if (!category) return list
  return list.filter((a) => a.tag === category)
}

/**
 * 篩選列要不要出現：只有一種分類時不顯示（比照教材資料庫的類別篩選）。
 * 公告少的時候它不礙事，多起來才變成篩選器。
 */
export function showCategoryFilter(list: { tag: string }[]): boolean {
  return new Set(list.map((a) => a.tag)).size > 1
}
