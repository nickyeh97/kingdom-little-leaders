import { describe, expect, it } from 'vitest'
import {
  PARENT_LESSON_COUNT,
  groupParentLessons,
  isCourseSegment,
  songsForDate,
  teachersOfClass,
} from '../parentLesson'
import type { ClassTeacher, ParentLessonSegment, Song, SongPlaylist } from '../../types'

function seg(p: Partial<ParentLessonSegment> = {}): ParentLessonSegment {
  return {
    class_group_id: 'kid',
    gathering_date: '2026-08-29',
    sort_order: 0,
    item: '主題信息',
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

  it('依聚會日分組，日期新到舊、同一天照 sort_order', () => {
    const days = groupParentLessons([
      seg({ gathering_date: '2026-08-22', sort_order: 1, item: '複習' }),
      seg({ gathering_date: '2026-08-29', sort_order: 2, item: '延伸活動' }),
      seg({ gathering_date: '2026-08-29', sort_order: 1, item: '主題信息' }),
    ])
    expect(days.map((d) => d.gathering_date)).toEqual(['2026-08-29', '2026-08-22'])
    expect(days[0].segments.map((s) => s.item)).toEqual(['主題信息', '延伸活動'])
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
      seg({ class_group_id: 'toddler', item: '幼童班主題' }),
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

describe('songsForDate：那天所屬的期間歌單', () => {
  const songs: Song[] = [
    { id: 's1', title: '這是天父世界' } as Song,
    { id: 's2', title: '主是我力量' } as Song,
  ]
  const playlists: SongPlaylist[] = [
    {
      id: 'p1',
      class_group_id: 'kid',
      title: '2026年7-8月',
      start_date: '2026-07-01',
      end_date: '2026-08-31',
      playlist_songs: [
        { song_id: 's2', sort_order: 2 },
        { song_id: 's1', sort_order: 1 },
      ],
    },
  ]

  it('取涵蓋該日期的歌單，依 sort_order 排序', () => {
    expect(songsForDate(playlists, songs, 'kid', '2026-08-29').map((s) => s.title)).toEqual([
      '這是天父世界',
      '主是我力量',
    ])
  })

  it('邊際：期間端點視為涵蓋', () => {
    expect(songsForDate(playlists, songs, 'kid', '2026-07-01')).toHaveLength(2)
    expect(songsForDate(playlists, songs, 'kid', '2026-08-31')).toHaveLength(2)
  })

  it('邊際：日期落在期間外、班別不符、曲目已刪除都不會壞掉', () => {
    expect(songsForDate(playlists, songs, 'kid', '2026-09-01')).toEqual([])
    expect(songsForDate(playlists, songs, 'toddler', '2026-08-29')).toEqual([])
    expect(songsForDate(playlists, [], 'kid', '2026-08-29')).toEqual([])
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
