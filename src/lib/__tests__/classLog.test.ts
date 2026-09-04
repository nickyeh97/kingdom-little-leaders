import { describe, expect, it } from 'vitest'
import { LOG_SCORE_VALUES, isValidLogScore, logScoreText } from '../classLog'

describe('課堂紀錄兩維指數（v11 #5）', () => {
  it('可選值為 1–5', () => {
    expect(LOG_SCORE_VALUES).toEqual([1, 2, 3, 4, 5])
  })

  it('邊際：範圍外、非整數、空值都不算有效', () => {
    expect(isValidLogScore(0)).toBe(false)
    expect(isValidLogScore(6)).toBe(false)
    expect(isValidLogScore(3.5)).toBe(false)
    expect(isValidLogScore(null)).toBe(false)
    expect(isValidLogScore(undefined)).toBe(false)
  })

  it('邊際值 1 與 5 有效', () => {
    expect(isValidLogScore(1)).toBe(true)
    expect(isValidLogScore(5)).toBe(true)
  })

  it('顯示文字帶維度名稱；未填回 null（畫面不顯示該維）', () => {
    expect(logScoreText('flow_score', 4)).toBe('流程順暢度 4')
    expect(logScoreText('cooperation_score', 2)).toBe('學生配合度 2')
    expect(logScoreText('flow_score', null)).toBeNull()
  })
})
