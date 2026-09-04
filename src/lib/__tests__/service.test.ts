import { describe, expect, it } from 'vitest'
import {
  CHILD_SERVICE_ITEM_PRESETS,
  SERVICE_COLUMNS,
  childServiceItemOptions,
  serviceColumnOf,
  serviceGrid,
  SERVICE_ITEM_PRESETS,
  SIGNUP_WEEKS_AHEAD,
} from '../service'

describe('服事排班設定', () => {
  it('老師服事項目為五項（v7 #4：全主責/助教（敬拜）/助教（真理）/助理/彈性時間）', () => {
    expect(SERVICE_ITEM_PRESETS).toEqual([
      '全主責',
      '助教（敬拜）',
      '助教（真理）',
      '助理',
      '彈性時間',
    ])
  })

  it('報名開放未來 12 次聚會', () => {
    expect(SIGNUP_WEEKS_AHEAD).toBe(12)
  })

  it('兒童服事有獨立的建議選項（源自教案分工服事）', () => {
    expect(CHILD_SERVICE_ITEM_PRESETS.length).toBeGreaterThan(0)
    expect(CHILD_SERVICE_ITEM_PRESETS).toContain('收奉獻')
  })
})

describe('childServiceItemOptions：勾選按鈕的項目來源（v11 #4）', () => {
  const items = [
    { name: '收奉獻', active: true },
    { name: '環境稽核', active: true },
    { name: '已停用項目', active: false },
  ]

  it('只列啟用中的字典項目，順序照傳入順序', () => {
    expect(childServiceItemOptions(items, [])).toEqual(['收奉獻', '環境稽核'])
  })

  it('已授權但不在字典（改名或停用）的舊項目仍顯示，同工才取消得掉', () => {
    expect(childServiceItemOptions(items, ['已停用項目', '招待'])).toEqual([
      '收奉獻',
      '環境稽核',
      '已停用項目',
      '招待',
    ])
  })

  it('邊際：已授權項目與字典重複時不會出現兩次', () => {
    expect(childServiceItemOptions(items, ['收奉獻'])).toEqual(['收奉獻', '環境稽核'])
  })

  it('邊際：字典讀不到（migration 未執行）時退回內建六項，畫面不會空白', () => {
    expect(childServiceItemOptions([], [])).toEqual(CHILD_SERVICE_ITEM_PRESETS)
  })
})

describe('serviceGrid：老師服事總覽表（v11 #10）', () => {
  const dates = ['2026-09-05', '2026-09-12']
  const signups = [
    { gathering_date: '2026-09-05', teacher_name: '小美', item: '全主責' },
    { gathering_date: '2026-09-05', teacher_name: '阿光', item: '助教（敬拜）' },
    { gathering_date: '2026-09-05', teacher_name: '阿光', item: '助教（真理）' },
    { gathering_date: '2026-09-05', teacher_name: '小恩', item: '助理' },
    { gathering_date: '2026-09-12', teacher_name: '小美', item: '彈性時間' },
  ]

  it('四類各自歸欄，助教兩種併入同一欄並保留括號分工', () => {
    const [wk1] = serviceGrid(dates, signups)
    expect(wk1.cells['全主責']).toEqual(['小美'])
    expect(wk1.cells['助教']).toEqual(['阿光（敬拜）', '阿光（真理）'])
    expect(wk1.cells['助理']).toEqual(['小恩'])
    expect(wk1.cells['彈性時間']).toEqual([])
  })

  it('每個聚會日各自成列，沒報名的欄留空', () => {
    const rows = serviceGrid(dates, signups)
    expect(rows.map((r) => r.date)).toEqual(dates)
    expect(rows[1].cells['彈性時間']).toEqual(['小美'])
    expect(rows[1].cells['全主責']).toEqual([])
  })

  it('SERVICE_COLUMNS 就是同工要的四欄', () => {
    expect([...SERVICE_COLUMNS]).toEqual(['全主責', '助教', '助理', '彈性時間'])
  })

  it('邊際：不屬於四類的自訂項目不硬塞欄位，另外列出', () => {
    const rows = serviceGrid(['2026-09-05'], [
      { gathering_date: '2026-09-05', teacher_name: '小樂', item: '場地佈置' },
    ])
    expect(rows[0].others).toEqual(['場地佈置·小樂'])
    for (const col of SERVICE_COLUMNS) expect(rows[0].cells[col]).toEqual([])
  })

  it('邊際：空白項目與沒有報名的日期都不會壞掉', () => {
    expect(serviceColumnOf('')).toBeNull()
    expect(serviceColumnOf('   ')).toBeNull()
    const rows = serviceGrid(['2026-09-05'], [])
    expect(rows[0].others).toEqual([])
  })

  it('現有的五個報名項目全部歸得了欄', () => {
    for (const item of SERVICE_ITEM_PRESETS) expect(serviceColumnOf(item)).not.toBeNull()
  })

  it('舊資料的「主責」（v7 之前，沒有「全」字）也歸到全主責欄', () => {
    expect(serviceColumnOf('主責')).toBe('全主責')
    expect(serviceColumnOf('全主責')).toBe('全主責')
    const rows = serviceGrid(['2026-09-05'], [
      { gathering_date: '2026-09-05', teacher_name: '小美', item: '主責' },
    ])
    expect(rows[0].cells['全主責']).toEqual(['小美'])
    expect(rows[0].others).toEqual([])
  })
})
