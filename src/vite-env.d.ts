/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** 由 vite.config.ts 的 define 注入，來源為 package.json 的 version（v9 #10） */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 「小領袖靈獸」遊戲部署網址；未設定時不顯示入口 */
  readonly VITE_SPIRIT_GAME_URL?: string
}
