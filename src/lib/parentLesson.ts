/**
 * 家長版簡易教案的呈現邏輯（v10 #2）。
 *
 * 需求：「僅查閱、注重在小孩上的課程而非流程」——
 * 家長看到的是「那天上了什麼」，不是同工的時間表，
 * 所以只列出白名單項目（v14 #6：敬拜／信息或主題／背金句／彈性時間）且有填內容的段落。
 *
 * 守則檢核（`docs/DESIGN_PRINCIPLES.md`）：這頁是回顧孩子上過什麼課，
 * 不呈現孩子的表現、不做班級之間的比較，也不預告未來進度（避免變成進度壓力）。
 */
import type { WeeklySongRow } from '../api/songs'
import type { ClassTeacher, ParentLessonSegment, Song } from '../types'

/** 家長可回看的聚會次數（決議：只到最近 4 次） */
export const PARENT_LESSON_COUNT = 4

export interface ParentLessonDay {
  gathering_date: string
  class_group_id: string
  segments: ParentLessonSegment[]
  /** 帶班老師（同一天可能多位；去重後保留出現順序） */
  teachers: string[]
}

/**
 * 家長看得到的教案項目（v14 #6）。
 *
 * 用「包含」而不是完全相等比對——`item` 是老師手打的自由文字，
 * 正式資料同時存在「信息」「信息 但以理在獅子坑」「信息／主題」三種寫法。
 * 「信息」與「主題」是同一件事的兩種叫法，任一符合就算。
 *
 * ⚠️ 這份清單同時存在於 `supabase/migrations/2026-09-05_parent_lesson_whitelist.sql`
 *    的 RPC 裡，**真正的邊界在那邊**（前端只是 UX，家長拿不到清單外的資料）。
 *    要新增項目請兩邊一起改；`__tests__/parentLesson.test.ts` 有對照測試。
 */
export const PARENT_VISIBLE_ITEMS = ['敬拜', '信息', '主題', '背金句', '彈性時間'] as const

/** 這個項目名稱會顯示給家長嗎？（教案頁用它提醒老師填內容） */
export function isParentVisibleItem(item: string): boolean {
  return PARENT_VISIBLE_ITEMS.some((w) => item.includes(w))
}

/**
 * 家長看得到的段落：白名單項目**且**有填內容。
 *
 * 沒填內容幾乎等於老師忘了寫（實測「背金句」7 筆全部空白），
 * 顯示一列空白的項目對家長沒有意義，所以不列出；改由教案頁提醒老師填寫。
 */
export function isCourseSegment(seg: ParentLessonSegment): boolean {
  return seg.content.trim() !== '' && isParentVisibleItem(seg.item)
}

/**
 * 依「聚會日 × 班別」分組，日期新到舊、同一天照 sort_order。
 * RPC 已排好序，但這裡不依賴它——來源換了也不會亂掉。
 */
export function groupParentLessons(segments: ParentLessonSegment[]): ParentLessonDay[] {
  const days = new Map<string, ParentLessonDay>()
  for (const seg of segments) {
    if (!isCourseSegment(seg)) continue
    const key = `${seg.gathering_date}|${seg.class_group_id}`
    let day = days.get(key)
    if (!day) {
      day = {
        gathering_date: seg.gathering_date,
        class_group_id: seg.class_group_id,
        segments: [],
        teachers: [],
      }
      days.set(key, day)
    }
    day.segments.push(seg)
    const name = seg.teacher_name.trim()
    if (name && !day.teachers.includes(name)) day.teachers.push(name)
  }
  const list = [...days.values()]
  for (const day of list) day.segments.sort((a, b) => a.sort_order - b.sort_order)
  return list.sort((a, b) =>
    a.gathering_date === b.gathering_date
      ? a.class_group_id.localeCompare(b.class_group_id)
      : b.gathering_date.localeCompare(a.gathering_date),
  )
}

/**
 * 那天唱的詩歌（v11 #1）：直接取「排到該聚會日」的歌，不再用整個雙月歌單推估。
 * 同一個函式也給詩歌頁用——傳入下次聚會日就是「下次要上課的歌」。
 */
export function songsForDate(
  weekly: WeeklySongRow[],
  songs: Song[],
  classGroupId: string,
  date: string,
): Song[] {
  const byId = new Map(songs.map((s) => [s.id, s]))
  return weekly
    .filter((w) => w.class_group_id === classGroupId && w.gathering_date === date)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((w) => byId.get(w.song_id))
    .filter((s): s is Song => s != null)
}

/** 某班的老師稱呼（供組織架構頁的「＊＊班的老師」區塊） */
export function teachersOfClass(teachers: ClassTeacher[], classGroupId: string): string[] {
  return teachers.filter((t) => t.class_group_id === classGroupId).map((t) => t.teacher_name)
}
