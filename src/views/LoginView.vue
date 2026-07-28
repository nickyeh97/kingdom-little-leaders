<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast, showSuccessToast } from 'vant'
import { isConfigured } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const displayName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.signIn(email.value.trim(), password.value)
      router.replace({ name: 'home' })
    } else {
      const loggedIn = await auth.signUp(displayName.value.trim(), email.value.trim(), password.value)
      if (loggedIn) {
        showSuccessToast('註冊成功，歡迎加入！')
        router.replace({ name: 'home' })
      } else {
        showSuccessToast('註冊成功，請至信箱點擊確認信後登入')
        mode.value = 'login'
      }
    }
  } catch (e) {
    const msg = (e as Error).message
    if (mode.value === 'register' && /already registered/i.test(msg)) {
      showFailToast('此 Email 已註冊過，請直接登入')
    } else {
      showFailToast(mode.value === 'login' ? '登入失敗，請確認帳號密碼' : `註冊失敗：${msg}`)
    }
  } finally {
    loading.value = false
  }
}

async function onGoogle() {
  try {
    await auth.signInWithGoogle() // 轉址至 Google，成功後回到本站
  } catch (e) {
    showFailToast(`Google 登入失敗：${(e as Error).message}`)
  }
}
</script>

<template>
  <div class="login-page">
    <div class="brand">
      <div class="logo" />
      <h1>兒童主日學整合平台</h1>
      <p class="hint">神國小領袖 · Kingdom Little Leaders</p>
    </div>

    <div class="card" v-if="isConfigured">
      <van-form @submit="onSubmit">
        <van-cell-group inset>
          <van-field
            v-if="mode === 'register'"
            v-model="displayName"
            name="displayName"
            label="稱呼"
            placeholder="例：家榛媽媽、王老師"
            :rules="[{ required: true, message: '請填寫稱呼' }]"
          />
          <van-field
            v-model="email"
            name="email"
            label="Email"
            placeholder="you@example.com"
            type="email"
            :rules="[{ required: true, message: '請填寫 Email' }]"
          />
          <van-field
            v-model="password"
            name="password"
            label="密碼"
            :placeholder="mode === 'register' ? '至少 6 碼' : '請輸入密碼'"
            type="password"
            :rules="[{ required: true, message: '請填寫密碼' }]"
          />
        </van-cell-group>
        <div style="margin: 16px">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            {{ mode === 'login' ? '登入' : '註冊' }}
          </van-button>
        </div>
      </van-form>

      <p class="switch-mode" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '首次使用？註冊帳號' : '已有帳號？返回登入' }}
      </p>

      <div class="divider"><span>或</span></div>

      <van-button round block class="google-btn" @click="onGoogle">
        <span class="g-icon">G</span> 使用 Google {{ mode === 'login' ? '登入' : '註冊' }}
      </van-button>

      <p v-if="mode === 'register'" class="hint center reg-note">
        註冊後預設為家長身分；老師與同工權限由管理者於名單頁開通
      </p>
    </div>

    <div class="card" v-else>
      <p><strong>尚未連接後端</strong></p>
      <p class="hint">
        請依 README 建立 Supabase 專案，並將 <code>.env.example</code> 複製為
        <code>.env.local</code> 填入金鑰後重啟。
      </p>
    </div>

    <p class="hint center">未來將支援 LINE / Apple 登入</p>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 96px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.brand {
  text-align: center;
}
.brand h1 {
  font-size: 22px;
  margin: 12px 0 4px;
}
.logo {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--kll-primary);
  margin: 0 auto;
}
.center {
  text-align: center;
}
.switch-mode {
  text-align: center;
  font-size: 13px;
  color: var(--kll-primary-dark);
  cursor: pointer;
  margin: 0 0 4px;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 16px;
  color: var(--kll-sub);
  font-size: 12px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--kll-border, #e0e5e3);
}
.google-btn {
  margin: 0 auto;
  width: calc(100% - 32px);
  display: block;
  border: 1px solid #dadce0;
}
.g-icon {
  display: inline-block;
  font-weight: 700;
  color: #4285f4;
  margin-right: 6px;
}
.reg-note {
  margin-top: 12px;
}
</style>
