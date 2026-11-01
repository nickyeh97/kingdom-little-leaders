<script setup lang="ts">
// npm run dev:staging（連測試資料庫）時頂端掛一條提示，避免把測試站當成正式站操作
const staging = import.meta.env.MODE === 'staging'
const dbHost = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/^https?:\/\//, '') ?? '未設定'
</script>

<template>
  <div v-if="staging" class="staging-banner">🧪 測試資料庫：{{ dbHost }}</div>
  <router-view />
</template>

<style scoped>
.staging-banner {
  position: sticky;
  top: 0;
  z-index: 3000;
  padding: 4px 12px;
  background: #fde68a;
  color: #713f12;
  font-size: 13px;
  text-align: center;
  word-break: break-all;
}
</style>
