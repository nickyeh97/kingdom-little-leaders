/**
 * LINE 登入綁定（v15 #1）。
 *
 * ## 為什麼是「綁定」而不是「用 LINE 註冊」
 *
 * 現有成員全部是 Email 或 Google 註冊的。若開放 LINE 當註冊管道，
 * 同一個人用 LINE 登入會拿到**另一個 Supabase user**——除非 email 相同且已驗證，
 * Supabase 才會自動併到同一個帳號。而 LINE 的 email scope 要另外向 LINE 申請核准，
 * 使用者還可以拒絕授權，所以「拿不到 email」是常態而非例外。
 *
 * 拿不到 email ＝ 一定產生第二個帳號：`approved=false`、沒有角色標籤、
 * 家長看不到自己的孩子、老師看不到班別，還要同工重新審核與重綁一次。
 * 對 39 人的固定名單制平台，這個代價遠大於「少一個註冊管道」。
 *
 * 所以定案（組長 2026-09-07）：**LINE 只當追加登入方式**——
 * 已登入的人在「我的」按綁定，走 `linkIdentity()` 把 LINE identity 掛到現有帳號上；
 * 綁完之後就能用 LINE 登入同一個帳號。新人仍走 Email / Google 註冊。
 *
 * ## 為什麼 provider 是 `custom:line`
 *
 * Supabase 沒有內建 LINE，但支援 Custom OIDC Provider（Free plan 可加 3 個），
 * 而 LINE Login v2.1 就是標準 OIDC（issuer `https://access.line.me`，支援 PKCE S256）。
 * 所以不必自己寫 Edge Function 當 OIDC shim——這一點推翻了 PROGRESS 裡
 * 「LINE 登入（Edge Function 自訂 OIDC）」的舊規劃。
 *
 * Supabase 規定自訂 provider 的識別字一律以 `custom:` 開頭。
 *
 * ## 外部設定（不在版控內，見 docs/DEVELOPMENT.md）
 *
 * - LINE Provider 底下開 Login channel（**與未來的 Messaging API channel 同一個 Provider**，
 *   否則 userId 對不起來，日後要推播會接不上）
 * - Supabase → Authentication → Providers 新增 custom OIDC，識別字 `line`
 * - Supabase → Authentication → **Enable Manual Linking 必須打開**，否則 `linkIdentity()` 會被拒
 */
import type { UserIdentity } from '@supabase/supabase-js'

/** Supabase 自訂 provider 識別字；設定畫面填 `line`，程式端要帶前綴 */
export const LINE_PROVIDER = 'custom:line' as const

/** 這個帳號綁過 LINE 了嗎？ */
export function findLineIdentity(identities: UserIdentity[] | null | undefined): UserIdentity | null {
  return identities?.find((i) => i.provider === LINE_PROVIDER) ?? null
}

/**
 * 能不能解除 LINE 綁定？
 *
 * Supabase 規定帳號至少要留一個 identity，否則使用者會把自己鎖在門外。
 * 這裡照同樣的規則擋在前端，讓按鈕直接變成停用而不是按下去才報錯。
 */
export function canUnlinkLine(identities: UserIdentity[] | null | undefined): boolean {
  const list = identities ?? []
  return findLineIdentity(list) != null && list.length >= 2
}

/**
 * 綁定狀態要顯示的文字。
 *
 * LINE 的 identity_data 欄位不保證有什麼——email scope 沒核准就沒有 email，
 * 名稱也可能缺，所以一路 fallback 到「已綁定」而不是印出 undefined。
 */
export function lineBindingLabel(identities: UserIdentity[] | null | undefined): string {
  const line = findLineIdentity(identities)
  if (!line) return '尚未綁定'
  const data = (line.identity_data ?? {}) as Record<string, unknown>
  for (const key of ['name', 'full_name', 'preferred_username']) {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return `已綁定：${v.trim()}`
  }
  return '已綁定'
}
