import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant, { Locale } from 'vant'
import zhTW from 'vant/es/locale/lang/zh-TW'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

// Vant 預設語系為簡體中文，切換為繁體中文（台灣）
Locale.use('zh-TW', zhTW)

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  // 先還原登入狀態，再掛 router，避免第一次導頁誤判未登入
  await useAuthStore().init()
  app.use(router)
  app.use(Vant)
  app.mount('#app')
}

bootstrap()
