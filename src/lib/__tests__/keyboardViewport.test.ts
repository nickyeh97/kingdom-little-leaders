// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { KEYBOARD_MIN_INSET, isTextEntry, keyboardInset } from '../keyboardViewport'

describe('軟體鍵盤高度計算（v15 #2）', () => {
  it('鍵盤跳出來：版面視窗沒變，視覺視窗縮小 → 差額就是鍵盤高度', () => {
    // iPad 直向 1024 高，鍵盤約 320
    expect(keyboardInset(1024, 704, 0)).toBe(320)
  })

  it('沒有鍵盤時是 0，不會讓彈窗白白位移', () => {
    expect(keyboardInset(1024, 1024, 0)).toBe(0)
  })

  it('網址列伸縮的幾十 px 不算鍵盤——跟著位移只會讓畫面抖動', () => {
    expect(keyboardInset(844, 844 - 60, 0)).toBe(0)
    expect(keyboardInset(844, 844 - (KEYBOARD_MIN_INSET - 1), 0)).toBe(0)
    expect(keyboardInset(844, 844 - KEYBOARD_MIN_INSET, 0)).toBe(KEYBOARD_MIN_INSET)
  })

  it('視覺視窗被捲動時要扣掉 offsetTop，否則會把落差誤算成鍵盤', () => {
    // 視覺視窗往下位移 200，但其實沒有鍵盤
    expect(keyboardInset(1024, 824, 200)).toBe(0)
    // 有鍵盤 320 且同時位移 100 → 仍應只算鍵盤那 320
    expect(keyboardInset(1024, 604, 100)).toBe(320)
  })

  it('邊際：拿到 NaN（某些瀏覽器在轉向瞬間）當作沒有鍵盤', () => {
    expect(keyboardInset(NaN, 704, 0)).toBe(0)
    expect(keyboardInset(1024, NaN, 0)).toBe(0)
  })

  it('邊際：視覺視窗比版面視窗還高（浮動鍵盤收合的瞬間）不會回負數', () => {
    expect(keyboardInset(1024, 1100, 0)).toBe(0)
  })

  it('取整數，避免 CSS 變數帶一長串小數', () => {
    expect(keyboardInset(1024, 703.6, 0)).toBe(320)
  })
})

describe('哪些元素要主動捲進畫面', () => {
  function el(html: string): Element {
    const d = document.createElement('div')
    d.innerHTML = html
    return d.firstElementChild!
  }

  it('會叫出鍵盤的欄位都算', () => {
    expect(isTextEntry(el('<textarea></textarea>'))).toBe(true)
    expect(isTextEntry(el('<input type="text">'))).toBe(true)
    expect(isTextEntry(el('<input>'))).toBe(true) // 沒寫 type 預設 text
    expect(isTextEntry(el('<input type="number">'))).toBe(true)
    expect(isTextEntry(el('<div contenteditable="true"></div>'))).toBe(true)
  })

  it('不會叫出鍵盤的不算——捲了只是徒增跳動', () => {
    expect(isTextEntry(el('<input type="checkbox">'))).toBe(false)
    expect(isTextEntry(el('<input type="radio">'))).toBe(false)
    expect(isTextEntry(el('<input type="button">'))).toBe(false)
    expect(isTextEntry(el('<input type="file">'))).toBe(false)
    expect(isTextEntry(el('<input type="range">'))).toBe(false)
    expect(isTextEntry(el('<button></button>'))).toBe(false)
    expect(isTextEntry(el('<div></div>'))).toBe(false)
  })

  it('邊際：null 不會炸', () => {
    expect(isTextEntry(null)).toBe(false)
  })
})
