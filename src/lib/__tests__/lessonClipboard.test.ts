// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canPasteInto,
  clearClip,
  clipLabel,
  readClip,
  writeClip,
  type SegmentClip,
} from '../lessonClipboard'

function clip(p: Partial<SegmentClip> = {}): SegmentClip {
  return {
    class_group_id: 'kid',
    class_name: '兒童班',
    source_date: '2026-09-05',
    time_text: '14:00',
    item: '敬拜',
    content: '來歡呼，來讚美',
    teacher_text: '小美老師',
    materials_text: '投影片',
    ...p,
  }
}

describe('教案段落剪貼簿（v14 #7）', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('存進去再讀回來，欄位一致', () => {
    writeClip(clip())
    expect(readClip()).toEqual(clip())
  })

  it('沒複製過就是 null', () => {
    expect(readClip()).toBeNull()
  })

  it('清除後讀不到東西', () => {
    writeClip(clip())
    clearClip()
    expect(readClip()).toBeNull()
  })

  it('不跨班別：只能貼回同一個班別（組長定案）', () => {
    const c = clip({ class_group_id: 'kid' })
    expect(canPasteInto(c, 'kid')).toBe(true)
    expect(canPasteInto(c, 'toddler')).toBe(false)
  })

  it('剪貼簿是空的就不能貼', () => {
    expect(canPasteInto(null, 'kid')).toBe(false)
  })

  it('邊際：localStorage 內容壞掉不會炸，當作沒複製過', () => {
    localStorage.setItem('kll.lessonClip.v1', '{壞掉的 JSON')
    expect(readClip()).toBeNull()
  })

  it('邊際：缺少班別的舊格式一律作廢，免得貼錯班', () => {
    localStorage.setItem('kll.lessonClip.v1', JSON.stringify({ item: '敬拜' }))
    expect(readClip()).toBeNull()
  })

  it('邊際：無痕視窗 localStorage 直接丟例外時，整頁不會壞掉', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => writeClip(clip())).not.toThrow()
    expect(readClip()).toBeNull()
  })

  it('提示列講清楚複製了什麼、從哪天來的', () => {
    expect(clipLabel(clip())).toBe('敬拜（複製自 2026-09-05）')
    expect(clipLabel(clip({ item: '', source_date: '' }))).toBe('未命名段落')
  })
})
