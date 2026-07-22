<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { isConfigured } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    await auth.signIn(email.value.trim(), password.value)
    router.replace({ name: 'home' })
  } catch {
    showFailToast('登入失敗，請確認帳號密碼')
  } finally {
    loading.value = false
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
            placeholder="請輸入密碼"
            type="password"
            :rules="[{ required: true, message: '請填寫密碼' }]"
          />
        </van-cell-group>
        <div style="margin: 16px">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            登入
          </van-button>
        </div>
      </van-form>
      <p class="hint center">首次使用？請點擊教會提供的邀請連結加入</p>
    </div>

    <div class="card" v-else>
      <p><strong>尚未連接後端</strong></p>
      <p class="hint">
        請依 README 建立 Supabase 專案，並將 <code>.env.example</code> 複製為
        <code>.env.local</code> 填入金鑰後重啟。
      </p>
    </div>

    <p class="hint center">未來將支援 Google / LINE / Apple 登入</p>
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
</style>
