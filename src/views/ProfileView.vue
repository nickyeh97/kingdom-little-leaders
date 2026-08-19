<script setup lang="ts">
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  try {
    await showConfirmDialog({ title: '登出', message: '確定要登出嗎？' })
  } catch {
    return // 使用者按取消
  }
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
    <van-cell-group inset v-if="auth.can('admin')">
      <van-cell
        title="名單與權限"
        label="成員角色標籤、孩子與家庭綁定"
        is-link
        @click="$router.push({ name: 'members' })"
      />
    </van-cell-group>
    <van-cell-group inset v-if="auth.can('teacher') || auth.can('admin')">
      <van-cell
        title="教案"
        label="每班每聚會日；段落分區塊共編"
        is-link
        @click="$router.push({ name: 'lesson-plans' })"
      />
      <van-cell
        title="聚會流程與運作要點"
        label="各班標準流程與班務規則"
        is-link
        @click="$router.push({ name: 'class-info' })"
      />
      <van-cell
        title="教材資料庫"
        label="外連教會 NAS / 雲端的教材目錄"
        is-link
        @click="$router.push({ name: 'materials' })"
      />
      <van-cell
        title="開會決議"
        label="大會/同工/班別會議紀錄與待辦追蹤"
        is-link
        @click="$router.push({ name: 'meetings' })"
      />
      <van-cell
        title="組織架構與分工"
        label="兒主團隊組別、職務與名單"
        is-link
        @click="$router.push({ name: 'org' })"
      />
      <van-cell
        title="出席紀錄（近半年）"
        label="可匯出 CSV 存 NAS / Google Sheet"
        is-link
        @click="$router.push({ name: 'records' })"
      />
      <van-cell
        title="課堂紀錄（本年）"
        label="教學內容、詩歌進度、課後反饋"
        is-link
        @click="$router.push({ name: 'class-log' })"
      />
    </van-cell-group>
    <van-cell-group inset>
      <van-cell title="版本" value="0.1.0（開發中）" />
      <van-cell title="登出" is-link @click="logout" />
    </van-cell-group>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 25px;
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
