/**
 * 家長版簡易教案的呈現邏輯（v10 #2）。
 *
 * 需求：「僅查閱、注重在小孩上的課程而非流程」——
 * 所以純流程段落（報到、點心、下課這類只有項目沒有內容的列）不列出，
 * 家長看到的是「那天上了什麼」，不是同工的時間表。
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

/** 有內容才算「課程」；只有項目沒內容的是流程列，不給家長看 */
export function isCourseSegment(seg: ParentLessonSegment): boolean {
  return seg.content.trim() !== ''
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
