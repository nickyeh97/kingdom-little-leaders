import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant, { Locale, showConfirmDialog, showFailToast } from 'vant'
import { registerSW } from 'virtual:pwa-register'
import zhTW from 'vant/es/locale/lang/zh-TW'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import { installKeyboardViewport } from './lib/keyboardViewport'
import { useAuthStore } from './stores/auth'
import './style.css'

// Vant 預設語系為簡體中文，切換為繁體中文（台灣）
Locale.use('zh-TW', zhTW)

/**
 * PWA 版本更新（v9 #11）。
 * 原本只註冊 Service Worker、從不檢查更新，而 sw.js 走 skipWaiting＋clientsClaim，
 * 造成「舊頁面 × 新資產」混版：畫面還在、按鈕卻靜默失效，使用者只能自己重整。
 * 這裡改為定期（每小時）與回到前景時檢查更新，有新版才提示；
 * 由使用者按下才重載，避免正在填出席/教案/課堂紀錄時草稿被沖掉。
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

function setupPwaUpdate() {
  const updateSW = registerSW({
    onNeedRefresh() {
      showConfirmDialog({
        title: '平台已更新',
        message: '有新版本可用，重新載入後即可使用最新功能。',
        confirmButtonText: '重新載入',
        cancelButtonText: '稍後',
      })
        .then(() => updateSW(true))
        .catch(() => {
          /* 使用者選擇稍後：下次檢查或重整時會再提示 */
        })
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => {})
      setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}

/**
 * 延遲載入失敗的保護（v9 #11）：部署新版後，舊分頁的帶雜湊 chunk 已不存在，
 * 點選單會靜默沒反應。偵測到動態匯入失敗就自動重載一次；
 * 以 sessionStorage 記錄避免無限重載，導頁成功後清除，之後仍可再救一次。
 */
const CHUNK_RELOAD_KEY = 'kll:chunk-reloaded'

function setupChunkErrorGuard() {
  router.onError((error) => {
    const message = String((error as Error)?.message ?? error)
    const isChunkError =
      /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
        message,
      )
    if (!isChunkError) return
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      showFailToast('頁面載入失敗，請下拉重新整理')
      return
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  })
  router.afterEach(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY))
}

async function bootstrap() {
  const app = createApp(App)
  // 未預期錯誤不再靜默：讓使用者知道發生什麼、可以自救（v9 #11）
  app.config.errorHandler = (err) => {
    console.error(err)
    showFailToast('頁面發生問題，請下拉重新整理')
  }
  app.use(createPinia())
  // 先還原登入狀態，再掛 router，避免第一次導頁誤判未登入
  await useAuthStore().init()
  app.use(router)
  app.use(Vant)
  app.mount('#app')

  setupChunkErrorGuard()
  setupPwaUpdate()
  installKeyboardViewport() // 軟體鍵盤不遮住底部彈窗的輸入框（v15 #2）
}

bootstrap()
