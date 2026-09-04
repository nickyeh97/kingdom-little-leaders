import { describe, expect, it } from 'vitest'
import { linkifyText, normalizeUrl } from '../url'

describe('normalizeUrl：外部連結正規化（v9 #6）', () => {
  it('正常網址原樣保留', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=KVDpKlkwDVc')).toBe(
      'https://www.youtube.com/watch?v=KVDpKlkwDVc',
    )
    expect(normalizeUrl('http://example.com/a')).toBe('http://example.com/a')
  })

  it('缺少 scheme 時補 https://（否則會被當成站內相對路徑）', () => {
    expect(normalizeUrl('www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc')
    expect(normalizeUrl('youtu.be/abc')).toBe('https://youtu.be/abc')
  })

  it('去前後空白與零寬字元', () => {
    expect(normalizeUrl('  https://youtu.be/abc  ')).toBe('https://youtu.be/abc')
    expect(normalizeUrl('https://youtu.be/abc\u200b')).toBe('https://youtu.be/abc')
    expect(normalizeUrl('\ufeffhttps://youtu.be/abc')).toBe('https://youtu.be/abc')
  })

  it('全形符號轉半形', () => {
    expect(normalizeUrl('ｈｔｔｐｓ：／／youtu.be／abc')).toBe('https://youtu.be/abc')
  })

  it('協定相對網址補上 https', () => {
    expect(normalizeUrl('//youtu.be/abc')).toBe('https://youtu.be/abc')
  })

  it('邊際：空值與空白字串回傳空字串（呼叫端據此不顯示連結）', () => {
    expect(normalizeUrl(null)).toBe('')
    expect(normalizeUrl(undefined)).toBe('')
    expect(normalizeUrl('   ')).toBe('')
  })

  it('邊際：非 http/https 的協定一律不放行（避免 javascript: 進到 href）', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('')
    expect(normalizeUrl('data:text/html,<script>')).toBe('')
    expect(normalizeUrl('mailto:someone@example.com')).toBe('')
  })

  it('邊際：開頭多餘斜線不會變成協定相對網址以外的怪路徑', () => {
    expect(normalizeUrl('///youtu.be/abc')).toBe('https://youtu.be/abc')
  })
})

describe('linkifyText：內文網址轉連結（v0.3.2）', () => {
  it('沒有網址時整段就是一段純文字', () => {
    const segs = linkifyText('9/5 崇拜後4:00到5:30在主堂舉行')
    expect(segs).toHaveLength(1)
    expect(segs[0].href).toBeUndefined()
  })

  it('抓得出內文中的網址，前後文字各自成段', () => {
    const segs = linkifyText('手冊在這裡 https://example.com/a 請點開看')
    expect(segs.map((s) => s.text)).toEqual(['手冊在這裡 ', 'https://example.com/a', ' 請點開看'])
    expect(segs[1].href).toBe('https://example.com/a')
    expect(segs[0].href).toBeUndefined()
  })

  it('網址在最後一行、前面有換行也抓得到', () => {
    const segs = linkifyText('8/29會帶領所有老師來使用平台\nhttps://claude.ai/code/artifact/abc')
    expect(segs[segs.length - 1].href).toBe('https://claude.ai/code/artifact/abc')
  })

  it('多個網址各自成段', () => {
    const segs = linkifyText('A https://a.com B https://b.com')
    expect(segs.filter((s) => s.href).map((s) => s.href)).toEqual(['https://a.com', 'https://b.com'])
  })

  it('邊際：黏在網址後的中英文標點還給文字段，不會被吃進連結', () => {
    expect(linkifyText('請看 https://a.com/x。').find((s) => s.href)?.href).toBe('https://a.com/x')
    expect(linkifyText('請看 https://a.com/x, 謝謝').find((s) => s.href)?.href).toBe('https://a.com/x')
    expect(linkifyText('（https://a.com/x）').find((s) => s.href)?.href).toBe('https://a.com/x')
  })

  it('邊際：只認 http/https，不把 javascript: 或純文字當連結', () => {
    expect(linkifyText('javascript:alert(1)').every((s) => !s.href)).toBe(true)
    expect(linkifyText('www.example.com').every((s) => !s.href)).toBe(true)
  })

  it('邊際：空值與空字串回空陣列，畫面不會渲染出空段落', () => {
    expect(linkifyText('')).toEqual([])
    expect(linkifyText(null)).toEqual([])
    expect(linkifyText(undefined)).toEqual([])
  })
})
