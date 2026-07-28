<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showFailToast } from 'vant'
import { listAnnouncements } from '../api/announcements'
import { listMyChildren, listPlans } from '../api/attendance'
import { listCheckIns, listFeedback } from '../api/checkin'
import { listAllChildren, listSessionLogsRange } from '../api/records'
import {
  feedbackDeadline,
  isFeedbackOpen,
  lastGathering,
  planDeadline,
  upcomingGathering,
  isPlanOpen,
  weekdayName,
} from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { Announcement, Child } from '../types'

const auth = useAuthStore()
const announcements = ref<Announcement[]>([])
const loading = ref(true)
/** 家長：本週還有孩子未填預先出席 */
const needPlan = ref(false)
/** 家長：上週各孩子的課堂表情回饋 */
const lastFeedback = ref<{ child: Child; moods: string[] }[]>([])
const gathering = upcomingGathering()
const deadline = planDeadline(gathering)
/** 老師：上堂課的課堂紀錄尚未填寫（兩天內提醒） */
const needClassLog = ref(false)
const lastG = lastGathering()
const feedbackDue = feedbackDeadline(lastG)

onMounted(async () => {
  try {
    announcements.value = await listAnnouncements()
    if (auth.can('parent')) {
      const [children, plans, feedback] = await Promise.all([
        listMyChildren(),
        listPlans(gathering),
        listFeedback(lastGathering()),
      ])
      if (isPlanOpen(gathering)) {
        const planned = new Set(plans.map((p) => p.child_id))
        needPlan.value = children.some((c) => !planned.has(c.id))
      }
      const byChild = new Map(feedback.map((f) => [f.child_id, f.moods]))
      lastFeedback.value = children
        .filter((c) => (byChild.get(c.id) ?? []).length > 0)
        .map((c) => ({ child: c, moods: byChild.get(c.id)! }))
    }
    // 老師：上堂課（兩天內）若有自己點名過的班別還沒填課堂紀錄 → 提醒
    if (auth.can('teacher') && isFeedbackOpen(lastG)) {
      const me = auth.session?.user.id
      const [checks, kids, logs] = await Promise.all([
        listCheckIns(lastG),
        listAllChildren(),
        listSessionLogsRange(lastG, lastG),
      ])
      const kidClass = new Map(kids.map((k) => [k.id, String(k.class_group_id)]))
      const myClasses = new Set(
        checks
          .filter((c) => c.checked_by === me)
          .map((c) => kidClass.get(c.child_id))
          .filter((x): x is string => Boolean(x)),
      )
      const logged = new Set(logs.map((l) => l.class_group_id))
      needClassLog.value = [...myClasses].some((id) => !logged.has(id))
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
      <div class="role-tags">
        <van-tag v-for="r in auth.roles" :key="r" round type="primary" size="medium">
          {{ r === 'admin' ? '管理者' : r === 'teacher' ? '老師' : '家長' }}
        </van-tag>
      </div>
    </header>

    <van-notice-bar
      v-if="needClassLog"
      left-icon="edit"
      mode="link"
      color="#7a5300"
      background="#fef1d9"
      :text="`上堂課（${lastG}）的課堂紀錄還沒填——${feedbackDue.toLocaleDateString('zh-TW')}（${weekdayName(feedbackDue)}）23:59 前完成`"
      @click="$router.push({ name: 'class-log' })"
    />

    <van-notice-bar
      v-if="needPlan"
      left-icon="todo-list-o"
      mode="link"
      :text="`本週出席還沒填喔——${weekdayName(deadline)} 23:59 前完成勾選`"
      @click="$router.push({ name: 'attendance' })"
    />

    <template v-if="lastFeedback.length > 0">
      <h3 class="section-title">上週課堂回饋</h3>
      <div v-for="f in lastFeedback" :key="f.child.id" class="card">
        <strong>{{ f.child.name }}</strong>
        <div class="mood-tags">
          <van-tag v-for="m in f.moods" :key="m" round type="primary" plain size="medium">
            {{ m }}
          </van-tag>
        </div>
      </div>
    </template>

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
.role-tags {
  display: flex;
  gap: 6px;
}
.mood-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
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
