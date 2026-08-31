import { describe, expect, it } from 'vitest'
import { parseFlowSheet } from '../sheetImport'

const TSV = ['項目\t必要性\t建議分鐘\t內容', '服事分工\t必做\t5\t當天服事長簽名', '敬拜\t必做\t20\t三首詩歌'].join(
  '\n',
)

describe('聚會流程 Sheet 匯入解析（v9 #2）', () => {
  it('從 Google Sheet 複製的 TSV 可正確解析', () => {
    const r = parseFlowSheet(TSV)
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([
      { title: '服事分工', extra: '必做', minutes: 5, content: '當天服事長簽名' },
      { title: '敬拜', extra: '必做', minutes: 20, content: '三首詩歌' },
    ])
  })

  it('CSV（含逗號與換行的引號欄位）也能解析', () => {
    const csv = ['項目,必要性,建議分鐘,內容', '"破冰","選做",10,"猜謎,分組\n第二行"'].join('\n')
    const r = parseFlowSheet(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toEqual({
      title: '破冰',
      extra: '選做',
      minutes: 10,
      content: '猜謎,分組\n第二行',
    })
  })

  it('欄位順序不拘、欄名可用別名（主題／方式／時間／說明）', () => {
    const r = parseFlowSheet(['說明\t時間\t主題\t方式', '內容甲\t15\t信息\t必做'].join('\n'))
    expect(r.rows[0]).toEqual({ title: '信息', extra: '必做', minutes: 15, content: '內容甲' })
  })

  it('缺少「項目」欄 → 指出讀到哪些欄名，不只說格式錯誤', () => {
    const r = parseFlowSheet(['內容\t分鐘', '甲\t5'].join('\n'))
    expect(r.rows).toEqual([])
    expect(r.errors[0]).toContain('找不到「項目」欄')
    expect(r.errors[0]).toContain('內容')
  })

  it('分鐘不是數字 → 指出第幾列與原始內容，該列略過', () => {
    const r = parseFlowSheet(['項目\t建議分鐘', '敬拜\t約莫'].join('\n'))
    expect(r.rows).toEqual([])
    expect(r.errors[0]).toContain('第 2 列')
    expect(r.errors[0]).toContain('約莫')
  })

  it('容錯：全形數字與「約10分鐘」都讀得到；分鐘留空視為未填', () => {
    const r = parseFlowSheet(['項目\t建議分鐘', '甲\t約10分鐘', '乙\t１５', '丙\t'].join('\n'))
    expect(r.rows.map((x) => x.minutes)).toEqual([10, 15, null])
  })

  it('項目空白的列會略過並指出列號', () => {
    const r = parseFlowSheet(['項目\t建議分鐘', '\t5', '敬拜\t20'].join('\n'))
    expect(r.rows).toHaveLength(1)
    expect(r.errors[0]).toContain('第 2 列')
  })

  it('必要性不是必做/選做 → 提醒但仍照原文匯入（不擋人）', () => {
    const r = parseFlowSheet(['項目\t必要性', '甲\t看情況'].join('\n'))
    expect(r.rows[0].extra).toBe('看情況')
    expect(r.errors[0]).toContain('看情況')
  })

  it('邊際：空白輸入與只有表頭', () => {
    expect(parseFlowSheet('').errors[0]).toContain('沒有讀到任何內容')
    expect(parseFlowSheet('   \n  ').errors[0]).toContain('沒有讀到任何內容')
    expect(parseFlowSheet('項目\t建議分鐘').errors[0]).toContain('沒有任何資料列')
  })

  it('邊際：Windows 換行與尾端空列不影響解析', () => {
    const r = parseFlowSheet('項目\t建議分鐘\r\n敬拜\t20\r\n\r\n')
    expect(r.rows).toHaveLength(1)
    expect(r.errors).toEqual([])
  })
})
