<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast, showSuccessToast } from 'vant'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

// 重設連結會自動建立登入 session；沒有 session＝連結失效或直接輸入網址
const hasSession = computed(() => auth.isLoggedIn)

const password = ref('')
const confirm = ref('')
const saving = ref(false)

async function submit() {
  if (password.value.length < 6) {
    showFailToast('密碼至少 6 碼')
    return
  }
  if (password.value !== confirm.value) {
    showFailToast('兩次輸入的密碼不一致')
    return
  }
  saving.value = true
  try {
    await auth.updatePassword(password.value)
    showSuccessToast('密碼已更新，歡迎回來！')
    router.replace({ name: 'home' })
  } catch (e) {
    showFailToast(`更新失敗：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <div class="brand">
      <div class="logo" />
      <h1>重設密碼</h1>
    </div>

    <div class="card" v-if="hasSession">
      <p class="hint desc">請設定新密碼（{{ auth.session?.user.email }}）</p>
      <van-cell-group inset>
        <van-field
          v-model="password"
          label="新密碼"
          type="password"
          placeholder="至少 6 碼"
        />
        <van-field
          v-model="confirm"
          label="再次輸入"
          type="password"
          placeholder="再輸入一次新密碼"
        />
      </van-cell-group>
      <van-button
        round
        block
        type="primary"
        :loading="saving"
        class="submit-btn"
        @click="submit"
      >
        更新密碼
      </van-button>
    </div>

    <div class="card" v-else>
      <p><strong>連結已失效</strong></p>
      <p class="hint">
        重設連結僅能使用一次且有時效；請回登入頁重新點選「忘記密碼」再試一次。
      </p>
      <van-button round block plain type="primary" class="submit-btn"
        @click="router.replace({ name: 'login' })">
        回登入頁
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
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
  font-size: 26px;
  margin: 12px 0 4px;
}
.logo {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: var(--kll-primary-soft);
  margin: 0 auto;
}
.card {
  padding: 20px 12px;
}
.desc {
  margin: 0 16px 12px;
}
.submit-btn {
  margin: 16px 16px 0;
  width: calc(100% - 32px);
}
</style>
