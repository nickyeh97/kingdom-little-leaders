/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '國度領袖兒童部整合平台',
        short_name: '兒童部平台',
        description: 'Kingdom Little Leaders — 出席、簽到、詩歌、公告',
        lang: 'zh-TW',
        theme_color: '#1F8A70',
        background_color: '#F6F8F7',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
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
