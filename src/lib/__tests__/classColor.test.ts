import { describe, expect, it } from 'vitest'
import { classColor, classTagStyle, classTone } from '../classColor'

describe('班別顏色（v9 #1）', () => {
  it('三個班別各自對應到指定色調', () => {
    expect(classTone('兒童班')).toBe('kid')
    expect(classTone('幼童班')).toBe('toddler')
    expect(classTone('幼幼班')).toBe('baby')
  })

  it('邊際：「幼幼」不可被誤判為「幼童」', () => {
    expect(classTone('幼幼班')).not.toBe('toddler')
    expect(classTone('幼童班')).not.toBe('baby')
  })

  it('邊際：空值、空白、未知班名回中性色，不會壞掉', () => {
    expect(classTone(null)).toBe('unknown')
    expect(classTone(undefined)).toBe('unknown')
    expect(classTone('   ')).toBe('unknown')
    expect(classTone('青少年班')).toBe('unknown')
    expect(classColor('青少年班')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('容錯：班名帶前後空白或未加「班」字仍可辨識', () => {
    expect(classTone(' 兒童班 ')).toBe('kid')
    expect(classTone('幼童')).toBe('toddler')
  })

  it('標籤樣式為淺底深字，三班互不相同', () => {
    const styles = ['兒童班', '幼童班', '幼幼班'].map((n) => classTagStyle(n))
    const backgrounds = new Set(styles.map((s) => s.background))
    expect(backgrounds.size).toBe(3)
    for (const s of styles) {
      expect(s.background).not.toBe(s.color)
      expect(s.border).toContain('1px solid')
    }
  })
})
