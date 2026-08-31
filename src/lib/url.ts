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
