/**
 * 教案段落剪貼簿（v14 #7）。
 *
 * 原本的「複製此段落」只能原地複製——`duplicate()` 把 `gathering_date` 與
 * `class_group_id` 寫死成當下的日期與班別，所以複製出來的一定落在同一天。
 * 組長要的是像 Sheet 複製欄位那樣：複製起來，切到任一天再貼上。
 *
 * 做法是把「複製」與「貼上」拆成兩個動作，中間放一個存在 `localStorage` 的剪貼簿——
 * 切換日期會重新載入資料、重新整理也可能發生，用記憶體存會掉。
 *
 * 三個已定案的邊界（組長 2026-09-05）：
 * - **不跨班別**：兒童班的段落不能貼到幼童班（老師欄位與教材通常不適用）。
 * - **新增不覆蓋**：貼上一律插在該天的最後面，不會蓋掉任何既有段落。
 * - **只做單段**：不做多選，避免一次貼進一堆重複的段落。
 *
 * `review_text`（課後執行）不進剪貼簿——那是當堂實況，沿用 v9 #5 的既有決定。
 */

const KEY = 'kll.lessonClip.v1'

export interface SegmentClip {
  /** 來源班別；貼上時必須相同，不跨班別 */
  class_group_id: string
  /** 來源班別名稱，只為了在提示列上講人話（如「兒童班」） */
  class_name: string
  /** 來源日期，讓老師確認自己複製到的是哪一天的段落 */
  source_date: string
  time_text: string
  item: string
  content: string
  teacher_text: string
  materials_text: string
}

/** localStorage 在無痕視窗／關閉 cookie 時會直接丟例外，所以每次存取都要包起來 */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function writeClip(clip: SegmentClip): void {
  safe(() => localStorage.setItem(KEY, JSON.stringify(clip)), undefined)
}

export function clearClip(): void {
  safe(() => localStorage.removeItem(KEY), undefined)
}

/**
 * 讀出剪貼簿內容；壞掉或缺欄位一律當作沒有東西
 * （舊版格式、使用者手動改過 localStorage 都可能發生，不能讓教案頁整頁壞掉）。
 */
export function readClip(): SegmentClip | null {
  const raw = safe(() => localStorage.getItem(KEY), null)
  if (!raw) return null
  const parsed = safe<unknown>(() => JSON.parse(raw), null)
  if (!parsed || typeof parsed !== 'object') return null
  const c = parsed as Record<string, unknown>
  const str = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '')
  if (!str('class_group_id')) return null
  return {
    class_group_id: str('class_group_id'),
    class_name: str('class_name'),
    source_date: str('source_date'),
    time_text: str('time_text'),
    item: str('item'),
    content: str('content'),
    teacher_text: str('teacher_text'),
    materials_text: str('materials_text'),
  }
}

/** 能不能貼到這個班別？不跨班別是硬規則 */
export function canPasteInto(clip: SegmentClip | null, classGroupId: string): boolean {
  return clip != null && clip.class_group_id === classGroupId
}

/** 剪貼簿提示列要顯示的字：講清楚「複製了什麼、從哪一天來的」 */
export function clipLabel(clip: SegmentClip): string {
  const item = clip.item.trim() || '未命名段落'
  return clip.source_date ? `${item}（複製自 ${clip.source_date}）` : item
}
