/**
 * 班別顏色（v9 #1）：兒童班＝太陽色、幼童班＝天藍色、幼幼班＝嫩綠色。
 * 依「班名」判斷（比照 performance.ts 的既有慣例），未知班別回中性色，
 * 日後新增班別不會壞掉、只是沒有專屬顏色。
 *
 * 顏色只用於**辨識**（一眼看出這孩子是哪一班），
 * 不得用來排序或比較班級（`docs/DESIGN_PRINCIPLES.md` 紅燈規則 #1）。
 */

export type ClassTone = 'kid' | 'toddler' | 'baby' | 'unknown'

export interface ClassPalette {
  /** 主色：用於頁籤等需要單一色值處 */
  color: string
  /** 標籤底色（淺） */
  soft: string
  /** 標籤文字色（深，確保對比度足夠） */
  text: string
}

const PALETTES: Record<ClassTone, ClassPalette> = {
  kid: { color: '#E8930C', soft: '#FDF0D8', text: '#8A5600' }, // 太陽色
  toddler: { color: '#2F8FD0', soft: '#E1EFFA', text: '#175C86' }, // 天藍色
  baby: { color: '#5FAF43', soft: '#E8F5E1', text: '#386B26' }, // 嫩綠色
  unknown: { color: '#8A9490', soft: '#EDF0EE', text: '#4A5350' },
}

/** 由班名判斷色調；順序重要——先比對「幼幼」再「幼童」，避免互相誤判 */
export function classTone(name?: string | null): ClassTone {
  const n = (name ?? '').trim()
  if (!n) return 'unknown'
  if (n.includes('幼幼')) return 'baby'
  if (n.includes('幼童')) return 'toddler'
  if (n.includes('兒童')) return 'kid'
  return 'unknown'
}

export function classPalette(name?: string | null): ClassPalette {
  return PALETTES[classTone(name)]
}

/** 標籤樣式：淺底＋深字＋同色細框（直接綁在 van-tag 的 :style） */
export function classTagStyle(name?: string | null) {
  const p = classPalette(name)
  return { background: p.soft, color: p.text, border: `1px solid ${p.color}` }
}

/** 主色：van-tabs 的 color 等只吃單一色值的地方 */
export function classColor(name?: string | null): string {
  return classPalette(name).color
}
