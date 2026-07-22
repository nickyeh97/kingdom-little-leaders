<script setup lang="ts">
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await showConfirmDialog({ title: '登出', message: '確定要登出嗎？' })
  await auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <h2>我的</h2>
    <div class="card center">
      <div class="avatar" />
      <strong>{{ auth.profile?.display_name }}</strong>
      <p class="hint">{{ auth.session?.user.email }}</p>
    </div>
    <van-cell-group inset>
      <van-cell title="版本" value="0.1.0（開發中）" />
      <van-cell title="登出" is-link @click="logout" />
    </van-cell-group>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 16px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--kll-primary-soft);
}
</style>
