/**
 * 「小領袖靈獸」遊戲入口（服事經歷卡電子版；遊戲 repo：nickyeh97/kingdom-spirits，GDD §6.2）。
 *
 * 平台把家長目前的 access token 與孩子 id 放在網址「片段」（# 之後）交給遊戲：
 * 片段不會送到伺服器、不進存取記錄；遊戲讀到後會立刻清掉網址列。
 * 只傳 access token（約 1 小時效期），不傳 refresh token——過期就回平台重開。
 * 遊戲端能讀寫什麼，一律由資料庫 RLS 決定（service_card_entries／beast_profiles）。
 */
import { normalizeUrl } from './url'
import type { Child } from '../types'

/** 遊戲網址（部署後設定 VITE_SPIRIT_GAME_URL）；未設定時回空字串，入口不顯示 */
export function spiritGameBaseUrl(): string {
  return normalizeUrl(import.meta.env.VITE_SPIRIT_GAME_URL as string | undefined)
}

/** 組出開啟遊戲的連結：<遊戲網址>#at=<token>&child=<孩子 id> */
export function spiritGameLink(baseUrl: string, accessToken: string, childId: string): string {
  const base = baseUrl.split('#')[0]
  return `${base}#at=${encodeURIComponent(accessToken)}&child=${encodeURIComponent(childId)}`
}

/**
 * 目前只開放兒童班：幼幼班不納入（沒有服事項目，2026-09-17）、幼童班暫不開放（2026-10-03）。
 * 與服事頁「兒童服事僅適用兒童班」同一個判斷（班別名稱含「兒童」）。班別資料缺漏時一律不顯示。
 */
export function spiritBeastEligible(child: Pick<Child, 'class_groups'>): boolean {
  return child.class_groups?.name.includes('兒童') ?? false
}
