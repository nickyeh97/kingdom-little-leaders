<script setup lang="ts">
import { stagingPointsToProduction, supabaseHost } from './lib/environment'

// npm run dev:staging（連測試資料庫）時頂端掛一條提示，避免把測試站當成正式站操作
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const staging = import.meta.env.MODE === 'staging'
const blocked = stagingPointsToProduction(import.meta.env.MODE, url)
const dbHost = supabaseHost(url) || '未設定'
</script>

<template>
  <div v-if="blocked" class="staging-banner danger">
    ⛔ 測試模式卻設定成正式資料庫（{{ dbHost }}），已停止連線
  </div>
  <div v-else-if="staging" class="staging-banner">🧪 測試資料庫：{{ dbHost }}</div>
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
.staging-banner.danger {
  background: #b91c1c;
  color: #fff;
  font-weight: 700;
}
</style>
