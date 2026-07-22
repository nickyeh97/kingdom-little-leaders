import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

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
