/**
 * 角色標籤的顏色（v11 #7）。
 *
 * 三個標籤原本同色，一整排看起來只有單一色、也分不出哪個是哪個。
 * 依參考站的色盤各給一色：管理者＝橘、老師＝綠、家長＝粉；
 * 平台主色（紫）留給互動元件，班別色（橘/藍/綠 soft）另有一套且帶邊框，兩者不混用。
 *
 * 顏色只用於辨識，不代表位階——角色是標籤集合，彼此沒有上下關係（見 CLAUDE.md）。
 */
import type { UserRole } from '../types'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  teacher: '老師',
  parent: '家長',
}

const ROLE_TONES: Record<UserRole, { soft: string; text: string }> = {
  admin: { soft: 'var(--kll-orange-soft)', text: 'var(--kll-orange-text)' },
  teacher: { soft: 'var(--kll-green-soft)', text: 'var(--kll-green-text)' },
  parent: { soft: 'var(--kll-pink-soft)', text: 'var(--kll-pink-text)' },
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? String(role)
}

export function roleTagStyle(role: UserRole) {
  const tone = ROLE_TONES[role] ?? ROLE_TONES.parent
  return { background: tone.soft, color: tone.text, border: 'none' }
}
