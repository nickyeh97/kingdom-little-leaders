<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from '../api/announcements'
import { listMyChildren, listPlans } from '../api/attendance'
import { listCheckIns, listClassGroups, listFeedback } from '../api/checkin'
import { listChildRosters } from '../api/childService'
import { listSessionLogsRange } from '../api/records'
import { listServiceWeeks } from '../api/service'
import { listLessonSegmentsByDate } from '../api/teaching'
import { classHasIndex } from '../lib/performance'
import {
  feedbackDeadline,
  isFeedbackOpen,
  lastGathering,
  planDeadline,
  upcomingGathering,
  upcomingGatherings,
  isPlanOpen,
  weekdayName,
} from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { Announcement, Child, ClassGroup } from '../types'

const auth = useAuthStore()
const announcements = ref<Announcement[]>([])
const classGroups = ref<ClassGroup[]>([])
const loading = ref(true)

/** 公告發布權（v3 決議 4）：同工可發全部；各班老師可發自己班別 */
const canPostAnn = computed(
  () => auth.can('admin') || (auth.can('teacher') && auth.teacherClassIds.length > 0),
)
/** 這則公告我可否編輯 */
function canEditAnn(a: Announcement): boolean {
  if (auth.can('admin')) return true
  return (
    auth.can('teacher') && !!a.class_group_id && auth.teacherClassIds.includes(a.class_group_id)
  )
}
/** 編輯視窗可選的班別：同工含「全體」；老師僅自己被指派的班別 */
const annClassOptions = computed<{ id: string | null; name: string }[]>(() => {
  if (auth.can('admin'))
    return [{ id: null, name: '全體' }, ...classGroups.value.map((g) => ({ id: g.id, name: g.name }))]
  return classGroups.value
    .filter((g) => auth.teacherClassIds.includes(g.id))
    .map((g) => ({ id: g.id, name: g.name }))
})
/** 家長：本週還有孩子未填預先出席 */
const needPlan = ref(false)
const gathering = upcomingGathering()
const deadline = planDeadline(gathering)

/** 家長：上週各孩子的課堂表情回饋（指數僅老師/同工可見——v4 決議 2） */
const lastFeedback = ref<{ child: Child; moods: string[] }[]>([])
/** 老師：上堂課的課堂紀錄尚未填寫（兩天內提醒） */
const needClassLog = ref(false)
/** 老師：已發布的服事安排（站內通知——v4 裁決 D） */
const myServiceDates = ref<string[]>([])
/** 家長：孩子被排上已發布的兒童服事表 */
const kidServiceDates = ref<string[]>([])
/** 同工：本週教案填寫狀況（已填班數／應填班數） */
const lessonStatus = ref<{ filled: number; total: number } | null>(null)
const lastG = lastGathering()
const feedbackDue = feedbackDeadline(lastG)

onMounted(async () => {
  try {
    announcements.value = await listAnnouncements()
    if (canPostAnn.value) classGroups.value = await listClassGroups()
    if (auth.can('parent')) {
      const svcDates = upcomingGatherings(4)
      const [children, plans, feedback, kidRosters] = await Promise.all([
        listMyChildren(),
        listPlans(gathering),
        listFeedback(lastGathering()),
        listChildRosters(svcDates[0], svcDates[svcDates.length - 1]),
      ])
      const myKidIds = new Set(children.map((c) => c.id))
      kidServiceDates.value = [
        ...new Set(
          kidRosters
            .filter(
              (r) =>
                r.published &&
                (r.child_service_assignments ?? []).some(
                  (a) => a.child_id && myKidIds.has(a.child_id),
                ),
            )
            .map((r) => r.gathering_date),
        ),
      ].sort()
      if (isPlanOpen(gathering)) {
        const planned = new Set(plans.map((p) => p.child_id))
        needPlan.value = children.some((c) => !planned.has(c.id))
      }
      const byChild = new Map(feedback.map((f) => [f.child_id, f.moods]))
      lastFeedback.value = children
        .filter((c) => (byChild.get(c.id) ?? []).length > 0)
        .map((c) => ({ child: c, moods: byChild.get(c.id)! }))
    }
    // 同工：本週教案填寫狀況（教案更新的站內通知）
    if (auth.can('admin')) {
      const [segs, allGroups] = await Promise.all([
        listLessonSegmentsByDate(gathering),
        listClassGroups(),
      ])
      const lessonClasses = allGroups.filter((g) => classHasIndex(g.name))
      const filled = new Set(segs.map((sg) => String(sg.class_group_id)))
      lessonStatus.value = {
        filled: lessonClasses.filter((g) => filled.has(String(g.id))).length,
        total: lessonClasses.length,
      }
    }
    // 老師：已發布服事表中有自己的排班 → 站內通知
    if (auth.can('teacher') || auth.can('admin')) {
      const svcDates = upcomingGatherings(4)
      const svcWeeks = await listServiceWeeks(svcDates[0], svcDates[svcDates.length - 1])
      const meId = auth.session?.user.id
      myServiceDates.value = [
        ...new Set(
          svcWeeks
            .filter(
              (w) =>
                w.published &&
                (w.service_assignments ?? []).some((a) => a.teacher_id === meId),
            )
            .map((w) => w.gathering_date),
        ),
      ].sort()
    }
    // 老師：上堂課（兩天內）若有自己點名過的班別還沒填課堂紀錄 → 提醒
    if (auth.can('teacher') && isFeedbackOpen(lastG)) {
      const me = auth.session?.user.id
      const [checks, logs] = await Promise.all([
        listCheckIns(lastG),
        listSessionLogsRange(lastG, lastG),
      ])
      // 點名紀錄自帶「點名所屬班別」（含跨班現場加入）
      const myClasses = new Set(
        checks.filter((c) => c.checked_by === me).map((c) => c.class_group_id),
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

// ---- 管理端：公告發布/編輯/刪除 ----
const editingAnn = ref<Announcement | 'new' | null>(null)
const annDraft = ref<{
  title: string
  body: string
  tag: string
  class_group_id: string | null
  pinned: boolean
}>({ title: '', body: '', tag: '公告', class_group_id: null, pinned: false })
const annSaving = ref(false)

function openAnnEditor(a: Announcement | null) {
  if (a ? !canEditAnn(a) : !canPostAnn.value) return
  editingAnn.value = a ?? 'new'
  annDraft.value = a
    ? { title: a.title, body: a.body, tag: a.tag, class_group_id: a.class_group_id, pinned: a.pinned }
    : {
        title: '',
        body: '',
        tag: '公告',
        // 老師沒有「全體」選項：預設帶入自己的第一個班別
        class_group_id: annClassOptions.value[0]?.id ?? null,
        pinned: false,
      }
}

async function saveAnn() {
  if (!annDraft.value.title.trim() || !annDraft.value.body.trim()) {
    showFailToast('標題與內容為必填')
    return
  }
  annSaving.value = true
  try {
    if (editingAnn.value === 'new') await createAnnouncement(annDraft.value)
    else if (editingAnn.value) await updateAnnouncement(editingAnn.value.id, annDraft.value)
    announcements.value = await listAnnouncements()
    showSuccessToast('已發布')
    editingAnn.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    annSaving.value = false
  }
}

async function removeAnn() {
  const target = editingAnn.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({ title: '刪除公告', message: `確定刪除「${target.title}」？` })
  } catch {
    return
  }
  try {
    await deleteAnnouncement(target.id)
    announcements.value = await listAnnouncements()
    showSuccessToast('已刪除')
    editingAnn.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
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
      v-if="auth.profile && !auth.isApproved"
      left-icon="clock-o"
      text="帳號審核中——請通知兒主同工核准，通過後即可使用完整功能"
    />

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

    <van-notice-bar
      v-if="lessonStatus && lessonStatus.filled > 0"
      left-icon="notes-o"
      mode="link"
      :text="`本週教案：${lessonStatus.filled}/${lessonStatus.total} 班已填寫——點我查看`"
      @click="$router.push({ name: 'lesson-plans' })"
    />

    <van-notice-bar
      v-if="kidServiceDates.length > 0"
      left-icon="smile-o"
      mode="link"
      color="#1f6f54"
      background="#e2f0e8"
      :text="`您的孩子有服事安排（${kidServiceDates.map((d) => d.slice(5).replace('-', '/')).join('、')}）——點日期到出席頁查看服事表`"
      @click="$router.push({ name: 'attendance' })"
    />

    <van-notice-bar
      v-if="myServiceDates.length > 0"
      left-icon="calendar-o"
      mode="link"
      color="#1f6f54"
      background="#e2f0e8"
      :text="`您有已發布的服事安排（${myServiceDates.map((d) => d.slice(5).replace('-', '/')).join('、')}）——點我查看服事表`"
      @click="$router.push({ name: 'service' })"
    />

    <template v-if="lastFeedback.length > 0">
      <h3 class="section-title">上週課堂回饋</h3>
      <p class="hint fb-hint">僅您能看到自己孩子的回饋</p>
      <div v-for="f in lastFeedback" :key="f.child.id" class="card">
        <div class="fb-head">
          <strong>{{ f.child.name }}</strong>
          <span class="hint">{{ f.child.class_groups?.name ?? '' }}</span>
        </div>
        <div class="mood-tags">
          <van-tag v-for="m in f.moods" :key="m" round type="primary" plain size="medium">
            {{ m }}
          </van-tag>
        </div>
      </div>
    </template>

    <div class="section-row">
      <h3 class="section-title">兒主公告</h3>
      <van-button v-if="canPostAnn" size="small" type="primary" plain @click="openAnnEditor(null)">
        ＋發布
      </van-button>
    </div>
    <van-skeleton v-if="loading" title :row="3" />
    <template v-else>
      <div v-if="announcements.length === 0" class="card hint">目前沒有公告</div>
      <div
        v-for="a in announcements"
        :key="a.id"
        class="card"
        :class="{ clickable: canEditAnn(a) }"
        @click="openAnnEditor(a)"
      >
        <div class="ann-head">
          <van-tag :type="a.tag === '重要' ? 'warning' : 'primary'" plain>{{ a.tag }}</van-tag>
          <van-tag v-if="a.class_group_id" type="success" plain>
            {{ a.class_groups?.name ?? '班別' }}
          </van-tag>
          <strong class="ann-title">{{ a.title }}</strong>
          <span v-if="a.pinned">📌</span>
        </div>
        <p class="ann-body">{{ a.body }}</p>
        <p class="hint">{{ fmtDate(a.created_at) }}</p>
      </div>
    </template>

    <van-popup
      :show="editingAnn !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editingAnn = null)"
    >
      <div class="ann-editor">
        <h3>{{ editingAnn === 'new' ? '發布公告' : '編輯公告' }}</h3>
        <van-field v-model="annDraft.title" label="標題" maxlength="60" placeholder="例：下主日合班敬拜通知" />
        <van-field v-model="annDraft.body" label="內容" type="textarea" rows="3" autosize maxlength="1000"
          placeholder="公告內容" />
        <van-cell title="對象" center>
          <template #value>
            <van-tag
              v-for="opt in annClassOptions"
              :key="opt.id ?? 'all'"
              round
              size="large"
              class="tag-opt"
              :type="annDraft.class_group_id === opt.id ? 'success' : 'default'"
              :plain="annDraft.class_group_id !== opt.id"
              @click="annDraft.class_group_id = opt.id"
            >
              {{ opt.name }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="標籤" center>
          <template #value>
            <van-tag
              v-for="t in ['公告', '重要']"
              :key="t"
              round
              size="large"
              class="tag-opt"
              :type="annDraft.tag === t ? (t === '重要' ? 'warning' : 'primary') : 'default'"
              :plain="annDraft.tag !== t"
              @click="annDraft.tag = t"
            >
              {{ t }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="置頂" center>
          <template #value><van-switch v-model="annDraft.pinned" size="20" /></template>
        </van-cell>
        <van-button round block type="primary" :loading="annSaving" class="save-btn" @click="saveAnn">
          {{ editingAnn === 'new' ? '發布' : '儲存' }}
        </van-button>
        <van-button
          v-if="editingAnn !== 'new'"
          round
          block
          plain
          type="danger"
          class="del-btn"
          @click="removeAnn"
        >
          刪除
        </van-button>
      </div>
    </van-popup>
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
  font-size: 25px;
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
.fb-hint {
  margin: -6px 0 10px;
}
.fb-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.clickable {
  cursor: pointer;
}
.ann-editor {
  padding: 20px 16px 28px;
}
.ann-editor h3 {
  margin: 0 0 12px;
  text-align: center;
  font-size: 22px;
}
.tag-opt {
  margin-left: 8px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
.ann-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ann-title {
  flex: 1;
  font-size: 21px;
}
.ann-body {
  font-size: 18px;
  color: var(--kll-sub);
  margin: 8px 0;
  white-space: pre-wrap;
}
</style>
