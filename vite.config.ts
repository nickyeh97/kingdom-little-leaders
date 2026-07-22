import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '兒童主日學整合平台',
        short_name: '兒主平台',
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
})
