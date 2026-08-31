import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../url'

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
