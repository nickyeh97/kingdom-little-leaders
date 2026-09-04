/**
 * 外部連結正規化（v9 #6）。
 * 老師/同工貼上的網址常帶前後空白、看不見的零寬字元、全形符號，或漏了 https://；
 * 這種字串交給瀏覽器會被當成站內相對路徑，點了等於沒反應。
 * 一律在「儲存時」與「顯示成連結時」都跑過一次，資料與畫面都不會踩到。
 */

/** 只允許 http/https，避免 javascript: 之類的字串被放進 href */
const SAFE_SCHEME = /^https?:\/\//i
/** 零寬字元與 BOM（從文件複製貼上常夾帶，肉眼看不出來） */
const INVISIBLE = /[\u200B-\u200D\uFEFF]/g
/** 全形英數與符號（如「ｈｔｔｐｓ：／／」） */
const FULLWIDTH = /[\uFF01-\uFF5E]/g

export function normalizeUrl(input: string | null | undefined): string {
  if (!input) return ''
  let url = input.replace(INVISIBLE, '').trim()
  if (!url) return ''
  url = url.replace(FULLWIDTH, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (SAFE_SCHEME.test(url)) return url
  // 其他協定（javascript:、data:、mailto: 等）一律不放行
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''
  // 協定相對網址（//host/path）與漏打 scheme 的網址都補上 https://
  return `https://${url.replace(/^\/+/, '')}`
}

// ---- 內文網址轉連結（v0.3.2）----
// 公告內文常直接貼網址（手冊、報名表、影片）。純文字渲染的話點不動，
// 家長只能自己複製貼到瀏覽器。這裡把內文切成「文字段」與「連結段」，
// 由呼叫端各自渲染——**不使用 v-html**，避免使用者輸入的內容變成可執行的標記。

/** 只認 http/https 開頭的完整網址；不猜 www. 開頭，避免把一般文字誤判成連結 */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'\u3000]+/g

/** 網址結尾常黏到的標點（中英文都算），不應算進連結 */
const TRAILING = /[.,;:!?、。，；：！？)\]}）］｝」』>]+$/

export interface TextSegment {
  text: string
  /** 有值代表這段是連結；已過 normalizeUrl，只會是 http/https */
  href?: string
}

export function linkifyText(input: string | null | undefined): TextSegment[] {
  const text = input ?? ''
  if (!text) return []
  const segments: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(URL_IN_TEXT)) {
    const start = m.index ?? 0
    let raw = m[0]
    // 把黏在網址後面的標點還給文字段（「請看 https://a.b/c。」的句號）
    const trimmed = raw.replace(TRAILING, '')
    const href = normalizeUrl(trimmed)
    if (!href) continue
    if (start > last) segments.push({ text: text.slice(last, start) })
    segments.push({ text: trimmed, href })
    last = start + trimmed.length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments.length > 0 ? segments : [{ text }]
}
