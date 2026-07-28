import { describe, expect, it } from 'vitest'
import { toCsv } from '../csv'

describe('CSV 匯出', () => {
  it('以 UTF-8 BOM 開頭（Excel 開啟中文不亂碼）', () => {
    expect(toCsv([['a']]).charCodeAt(0)).toBe(0xfeff)
  })

  it('一般欄位以逗號分隔、CRLF 換行', () => {
    const csv = toCsv([
      ['日期', '孩子'],
      ['2026-07-25', '王小明'],
    ]).slice(1)
    expect(csv).toBe('日期,孩子\r\n2026-07-25,王小明')
  })

  it('邊際：含逗號、雙引號、換行的欄位需正確跳脫', () => {
    const csv = toCsv([['a,b', 'say "hi"', 'line1\nline2']]).slice(1)
    expect(csv).toBe('"a,b","say ""hi""","line1\nline2"')
  })

  it('邊際：空欄位保留位置', () => {
    expect(toCsv([['a', '', 'c']]).slice(1)).toBe('a,,c')
  })
})
