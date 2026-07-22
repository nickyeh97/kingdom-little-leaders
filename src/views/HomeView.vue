<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showFailToast } from 'vant'
import { listAnnouncements } from '../api/announcements'
import { listMyChildren, listPlans } from '../api/attendance'
import { upcomingSunday, isPlanOpen } from '../lib/sunday'
import { useAuthStore } from '../stores/auth'
import type { Announcement } from '../types'

const auth = useAuthStore()
const announcements = ref<Announcement[]>([])
const loading = ref(true)
/** 家長：本週還有孩子未填預先出席 */
const needPlan = ref(false)
const sunday = upcomingSunday()

onMounted(async () => {
  try {
    announcements.value = await listAnnouncements()
    if (auth.role === 'parent' && isPlanOpen(sunday)) {
      const [children, plans] = await Promise.all([listMyChildren(), listPlans(sunday)])
      const planned = new Set(plans.map((p) => p.child_id))
      needPlan.value = children.some((c) => !planned.has(c.id))
    }
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW')
}
</script>

<template>
  <div class="page">
    <header class="top">
      <div>
        <h2>平安，{{ auth.profile?.display_name ?? '' }} 👋</h2>
        <p class="hint">{{ new Date().toLocaleDateString('zh-TW') }}</p>
      </div>
      <van-tag round type="primary" size="medium">
        {{ auth.role === 'admin' ? '管理者' : auth.role === 'teacher' ? '老師' : '家長' }}
      </van-tag>
    </header>

    <van-notice-bar
      v-if="needPlan"
      left-icon="todo-list-o"
      mode="link"
      text="本週出席還沒填喔——週三 23:59 前完成勾選"
      @click="$router.push({ name: 'attendance' })"
    />

    <h3 class="section-title">兒主公告</h3>
    <van-skeleton v-if="loading" title :row="3" />
    <template v-else>
      <div v-if="announcements.length === 0" class="card hint">目前沒有公告</div>
      <div v-for="a in announcements" :key="a.id" class="card">
        <div class="ann-head">
          <van-tag :type="a.tag === '重要' ? 'warning' : 'primary'" plain>{{ a.tag }}</van-tag>
          <strong class="ann-title">{{ a.title }}</strong>
          <span v-if="a.pinned">📌</span>
        </div>
        <p class="ann-body">{{ a.body }}</p>
        <p class="hint">{{ fmtDate(a.created_at) }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.top h2 {
  margin: 0;
  font-size: 18px;
}
.ann-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ann-title {
  flex: 1;
  font-size: 15px;
}
.ann-body {
  font-size: 13px;
  color: var(--kll-sub);
  margin: 8px 0;
  white-space: pre-wrap;
}
</style>
