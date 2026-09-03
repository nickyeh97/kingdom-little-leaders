import { describe, expect, it } from 'vitest'
import {
  CHILD_SERVICE_ITEM_PRESETS,
  childServiceItemOptions,
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
