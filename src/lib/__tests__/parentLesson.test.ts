import { describe, expect, it } from 'vitest'
import {
  PARENT_LESSON_COUNT,
  PARENT_VISIBLE_ITEMS,
  groupParentLessons,
  isCourseSegment,
  isParentVisibleItem,
  songsForDate,
  teachersOfClass,
} from '../parentLesson'
import type { WeeklySongRow } from '../../api/songs'
import type { ClassTeacher, ParentLessonSegment, Song } from '../../types'

function seg(p: Partial<ParentLessonSegment> = {}): ParentLessonSegment {
  return {
    class_group_id: 'kid',
    gathering_date: '2026-08-29',
    sort_order: 0,
    item: '信息',
    content: '大衛與歌利亞',
    teacher_name: '小美老師',
    ...p,
  }
}

describe('家長版簡易教案（v10 #2）', () => {
  it('只回看最近 4 次聚會', () => {
    expect(PARENT_LESSON_COUNT).toBe(4)
  })

  it('只有項目、沒有內容的流程列不給家長看', () => {
    expect(isCourseSegment(seg({ item: '報到', content: '' }))).toBe(false)
    expect(isCourseSegment(seg({ item: '點心', content: '   ' }))).toBe(false)
    expect(isCourseSegment(seg())).toBe(true)
  })

  it('白名單外的項目不給家長看，就算有填內容也一樣（v14 #6）', () => {
    expect(isCourseSegment(seg({ item: '環境整理', content: '收拾桌椅' }))).toBe(false)
    expect(isCourseSegment(seg({ item: '服事分工', content: '小恩負責奉獻' }))).toBe(false)
    expect(isCourseSegment(seg({ item: '破冰', content: '大風吹' }))).toBe(false)
  })

  it('白名單項目沒填內容也不顯示——空白列對家長沒意義，改由教案頁提醒老師（v14 #6）', () => {
    expect(isCourseSegment(seg({ item: '背金句', content: '' }))).toBe(false)
    expect(isCourseSegment(seg({ item: '敬拜', content: '  ' }))).toBe(false)
    expect(isCourseSegment(seg({ item: '背金句', content: '約翰一書 4:7' }))).toBe(true)
  })

  it('項目用「包含」比對——item 是老師手打的自由文字（v14 #6）', () => {
    // 正式資料裡同時存在這三種寫法
    expect(isParentVisibleItem('信息')).toBe(true)
    expect(isParentVisibleItem('信息 但以理在獅子坑')).toBe(true)
    expect(isParentVisibleItem('信息／主題')).toBe(true)
    // 「信息」與「主題」是同一件事的兩種叫法，任一符合就算
    expect(isParentVisibleItem('今日主題')).toBe(true)
    expect(isParentVisibleItem('結束禱告')).toBe(false)
  })

  it('白名單內容必須與 RPC 的 SQL 陣列一致（v14 #6）', () => {
    // supabase/migrations/2026-09-05_parent_lesson_whitelist.sql 的
    // unnest(array[...]) 是真正的邊界；這裡照抄一份，改一邊沒改另一邊就會紅
    expect([...PARENT_VISIBLE_ITEMS]).toEqual(['敬拜', '信息', '主題', '背金句', '彈性時間'])
  })

  it('依聚會日分組，日期新到舊、同一天照 sort_order', () => {
    const days = groupParentLessons([
      seg({ gathering_date: '2026-08-22', sort_order: 1, item: '敬拜' }),
      seg({ gathering_date: '2026-08-29', sort_order: 2, item: '彈性時間' }),
      seg({ gathering_date: '2026-08-29', sort_order: 1, item: '信息' }),
    ])
    expect(days.map((d) => d.gathering_date)).toEqual(['2026-08-29', '2026-08-22'])
    expect(days[0].segments.map((s) => s.item)).toEqual(['信息', '彈性時間'])
  })

  it('同一天多位老師去重後保留出現順序', () => {
    const days = groupParentLessons([
      seg({ sort_order: 1, teacher_name: '小美老師' }),
      seg({ sort_order: 2, teacher_name: '阿光老師' }),
      seg({ sort_order: 3, teacher_name: '小美老師' }),
    ])
    expect(days[0].teachers).toEqual(['小美老師', '阿光老師'])
  })

  it('邊際：同一天跨班別（家長有多個孩子）分成兩組，不會混在一起', () => {
    const days = groupParentLessons([
      seg({ class_group_id: 'kid', item: '兒童班主題' }),
      seg({ class_group_id: 'toddler', item: '幼童班主題' }),  // 含「主題」，在白名單內
    ])
    expect(days).toHaveLength(2)
    expect(new Set(days.map((d) => d.class_group_id))).toEqual(new Set(['kid', 'toddler']))
  })

  it('邊際：全是流程列或空陣列時回空，畫面顯示提示而非空白卡片', () => {
    expect(groupParentLessons([])).toEqual([])
    expect(groupParentLessons([seg({ content: '' })])).toEqual([])
  })

  it('邊際：老師姓名空白不會產生空字串的老師', () => {
    const days = groupParentLessons([seg({ teacher_name: '  ' })])
    expect(days[0].teachers).toEqual([])
  })
})

describe('songsForDate：那次聚會排定的歌（v11 #1）', () => {
  const songs: Song[] = [
    { id: 's1', title: '這是天父世界' } as Song,
    { id: 's2', title: '主是我力量' } as Song,
  ]
  const weekly: WeeklySongRow[] = [
    { class_group_id: 'kid', gathering_date: '2026-08-29', song_id: 's2', sort_order: 2 },
    { class_group_id: 'kid', gathering_date: '2026-08-29', song_id: 's1', sort_order: 1 },
    { class_group_id: 'kid', gathering_date: '2026-09-05', song_id: 's2', sort_order: 1 },
    { class_group_id: 'toddler', gathering_date: '2026-08-29', song_id: 's1', sort_order: 1 },
  ]

  it('只取該班該日排定的歌，依 sort_order 排序', () => {
    expect(songsForDate(weekly, songs, 'kid', '2026-08-29').map((s) => s.title)).toEqual([
      '這是天父世界',
      '主是我力量',
    ])
  })

  it('不同聚會日各自獨立——換一週就換一組歌', () => {
    expect(songsForDate(weekly, songs, 'kid', '2026-09-05').map((s) => s.title)).toEqual([
      '主是我力量',
    ])
  })

  it('同一天不同班別互不干擾', () => {
    expect(songsForDate(weekly, songs, 'toddler', '2026-08-29').map((s) => s.title)).toEqual([
      '這是天父世界',
    ])
  })

  it('邊際：沒排歌的日期、未知班別、曲庫查無此曲都回空陣列', () => {
    expect(songsForDate(weekly, songs, 'kid', '2026-09-12')).toEqual([])
    expect(songsForDate(weekly, songs, 'baby', '2026-08-29')).toEqual([])
    expect(songsForDate(weekly, [], 'kid', '2026-08-29')).toEqual([])
  })
})

describe('teachersOfClass：班別老師名單（v10 #1）', () => {
  const teachers: ClassTeacher[] = [
    { class_group_id: 'kid', teacher_name: '小美老師' },
    { class_group_id: 'kid', teacher_name: '阿光老師' },
    { class_group_id: 'toddler', teacher_name: '小恩老師' },
  ]

  it('只取該班的老師', () => {
    expect(teachersOfClass(teachers, 'kid')).toEqual(['小美老師', '阿光老師'])
  })

  it('邊際：沒有指派老師的班別回空陣列', () => {
    expect(teachersOfClass(teachers, 'baby')).toEqual([])
  })
})
