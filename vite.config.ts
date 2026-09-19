/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

export default defineConfig({
  // 版本號以 package.json 為單一來源，介面顯示不會與之走鐘（v9 #10）
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    vue(),
    VitePWA({
      // v9 #11：改 prompt 模式＋自行註冊（main.ts），有新版時提示使用者再重載，
      // 不在填寫表單時強制刷新；autoUpdate 會造成「舊頁面 × 新資產」混版
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: '國度領袖兒童牧區整合平台',
        short_name: '兒童牧區平台',
        description: 'Kingdom Little Leaders — 出席、簽到、詩歌、公告',
        lang: 'zh-TW',
        // 與 style.css 的 --kll-primary / --kll-bg 一致；icon 底色 #6f5ba8 與主色只差一點點，直接用主色
        theme_color: '#7462a2',
        background_color: '#fdf9f7',
        display: 'standalone',
        icons: [
          { src: 'kll_logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'kll_logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // maskable：Android 會把圖裁成圓形/方圓形，內容要留在中央安全區，
          // 沒有這張的話系統會自己補白底圓框，看起來像沒設計過
          {
            src: 'kll_logo-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    // 預設 node 環境（純邏輯測試）；元件/路由測試於檔頭以
    // `// @vitest-environment jsdom` 個別切換
    environment: 'node',
  },
})
