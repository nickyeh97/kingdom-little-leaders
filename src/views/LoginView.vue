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

/**
 * LINE 登入（v15 #1）：**只給已經在「我的」綁定過 LINE 的人用**。
 *
 * 沒綁定就按，Supabase 會當成新使用者建一個空帳號（待審核、沒有角色、沒綁孩子），
 * 本人會以為自己的資料不見了。所以按鈕只出現在登入模式、不出現在註冊模式，
 * 下面也寫清楚要先綁定；真的誤按了，首頁的審核中提醒會告訴他怎麼救。
 */
async function onLine() {
  try {
    await auth.signInWithLine()
  } catch (e) {
    showFailToast(`LINE 登入失敗：${(e as Error).message}`)
  }
}

// ---- 忘記密碼（v5 反饋 #4）----
const forgotOpen = ref(false)
const forgotEmail = ref('')
const forgotSending = ref(false)

function openForgot() {
  forgotEmail.value = email.value.trim()
  forgotOpen.value = true
}

async function sendReset() {
  const target = forgotEmail.value.trim()
  if (!target) {
    showFailToast('請填寫註冊時使用的 Email')
    return
  }
  forgotSending.value = true
  try {
    await auth.resetPassword(target)
    showSuccessToast('重設連結已寄出，請至信箱點擊後設定新密碼')
    forgotOpen.value = false
  } catch (e) {
    const msg = (e as Error).message
    showFailToast(
      /rate limit/i.test(msg)
        ? '寄信額度暫時已滿，請約一小時後再試，或聯繫兒童牧區同工協助重設'
        : `寄送失敗：${msg}`,
    )
  } finally {
    forgotSending.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="brand">
      <div class="logo" />
      <h1>國度領袖兒童牧區整合平台</h1>
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
            placeholder="請填您的名字"
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

      <p v-if="mode === 'login'" class="switch-mode forgot" @click="openForgot">忘記密碼？</p>

      <div class="divider"><span>或</span></div>

      <van-button round block class="google-btn" @click="onGoogle">
        <span class="g-icon">G</span> 使用 Google {{ mode === 'login' ? '登入' : '註冊' }}
      </van-button>

      <template v-if="mode === 'login'">
        <van-button round block class="line-btn" @click="onLine">
          <span class="l-icon">LINE</span> 使用 LINE 登入
        </van-button>
        <p class="hint center line-note">
          請先用 Email 或 Google 登入後，到「我的 → 登入方式」綁定 LINE，才能從這裡登入
        </p>
      </template>

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

    <p class="hint center">未來將支援 Apple 登入</p>

    <!-- 忘記密碼彈窗 -->
    <van-popup
      :show="forgotOpen"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (forgotOpen = v)"
    >
      <div class="forgot-editor">
        <h3>重設密碼</h3>
        <p class="hint forgot-desc">
          輸入註冊時使用的 Email，我們會寄送重設密碼的連結給您。
        </p>
        <van-field
          v-model="forgotEmail"
          label="Email"
          type="email"
          placeholder="you@example.com"
        />
        <van-button
          round
          block
          type="primary"
          :loading="forgotSending"
          class="forgot-btn"
          @click="sendReset"
        >
          寄送重設連結
        </van-button>
      </div>
    </van-popup>
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
  font-size: 28px;
  margin: 12px 0 4px;
}
.forgot {
  margin-top: 2px;
}
.forgot-editor {
  padding: 20px 16px 28px;
}
.forgot-editor h3 {
  margin: 0 0 10px;
  text-align: center;
  font-size: 22px;
}
.forgot-desc {
  margin: 0 16px 12px;
}
.forgot-btn {
  margin-top: 14px;
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
  font-size: 18px;
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
  font-size: 16px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--kll-line);
}
.line-btn {
  margin-top: 10px;
  border: 1px solid var(--kll-green);
  color: var(--kll-green-text);
  background: var(--kll-card);
}
.l-icon {
  font-weight: 900;
  letter-spacing: 0.5px;
  margin-right: 6px;
}
.line-note {
  margin-top: 8px;
  line-height: 1.7;
}
.google-btn {
  margin: 0 auto;
  width: calc(100% - 32px);
  display: block;
  border: 1px solid var(--kll-border);
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
