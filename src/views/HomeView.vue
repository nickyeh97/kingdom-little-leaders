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
import { listCheckIns, listClassGroups } from '../api/checkin'
import { listChildRosters } from '../api/childService'
import { listSessionLogsRange } from '../api/records'
import { listServiceWeeks } from '../api/service'
import { listMeetings } from '../api/meetings'
import { listLessonSegmentsByDate } from '../api/teaching'
import { LINE_PROVIDER } from '../lib/lineIdentity'
import { classHasIndex } from '../lib/performance'
import { classTagStyle } from '../lib/classColor'
import { linkifyText } from '../lib/url'
import { classesMissingLog } from '../lib/teaching'
import {
  ANNOUNCEMENT_CATEGORIES,
  CATEGORY_ALL,
  CATEGORY_DEFAULT,
  announcementDateText,
  categoryIcon,
  categoryStyle,
  filterByCategory,
  showCategoryFilter,
} from '../lib/announcement'
import { roleLabel, roleTagStyle } from '../lib/roleColor'
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
import type { Announcement, ClassGroup } from '../types'

const auth = useAuthStore()
const announcements = ref<Announcement[]>([])
/** 公告分類篩選（v0.3.2）：預設「全部」，不預先藏起任何一則 */
const annCategory = ref<string>(CATEGORY_ALL)
const shownAnns = computed(() => filterByCategory(announcements.value, annCategory.value))
const annFilterVisible = computed(() => showCategoryFilter(announcements.value))
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

/**
 * 審核中的提醒文字（v15 #1）。
 *
 * 一般新人照舊請同工核准即可。但**用 LINE 登入卻沒綁定過**的人會落到同一個狀態——
 * 那其實是誤開的第二個帳號，本人往往以為自己的孩子與權限不見了。
 * 這種情況要講的是「怎麼救」，不是「等審核」，所以文案分開。
 */
const pendingText = computed(() =>
  auth.profile?.auth_provider === LINE_PROVIDER
    ? '這是用 LINE 新開的帳號。若您原本就有帳號，請先登出、改用原本的 Email 或 Google 登入，'
      + '再到「我的 → 登入方式」綁定 LINE；若您確實是新成員，請通知兒童牧區同工核准'
    : '帳號審核中——請通知兒童牧區同工核准，通過後即可使用完整功能',
)

/** 老師：上堂課我點過名、但還沒填課堂紀錄的班別（兩天內提醒；空陣列＝不提醒） */
const missingLogClasses = ref<{ id: string; name: string }[]>([])
/** 老師：已發布的服事安排（站內通知——v4 裁決 D） */
const myServiceDates = ref<string[]>([])
/** 家長：孩子被排上已發布的兒童服事表 */
const kidServiceDates = ref<string[]>([])
/** 同工：本週教案填寫狀況（已填班數／應填班數） */
const lessonStatus = ref<{ filled: number; total: number } | null>(null)
/** 同工：會議待辦逾期數（C-05 狀態追蹤） */
const overdueItems = ref(0)
const lastG = lastGathering()
const feedbackDue = feedbackDeadline(lastG)

onMounted(async () => {
  try {
    announcements.value = await listAnnouncements()
    if (canPostAnn.value) classGroups.value = await listClassGroups()
    if (auth.can('parent')) {
      const svcDates = upcomingGatherings(4)
      const [children, plans, kidRosters] = await Promise.all([
        listMyChildren(),
        listPlans(gathering),
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
    }
    // 同工：本週教案填寫狀況（教案更新的站內通知）＋會議待辦逾期
    if (auth.can('admin')) {
      const todayIso = new Date().toISOString().slice(0, 10)
      const [segs, allGroups, mts] = await Promise.all([
        listLessonSegmentsByDate(gathering),
        listClassGroups(),
        listMeetings(),
      ])
      overdueItems.value = mts
        .flatMap((m) => m.meeting_items ?? [])
        .filter((i) => i.status !== 'done' && !!i.due_date && i.due_date < todayIso).length
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
    // 上堂課（兩天內）有上課卻還沒填課堂紀錄的班別 → 提醒同工與該班老師
    if ((auth.can('teacher') || auth.can('admin')) && isFeedbackOpen(lastG)) {
      const [checks, logs] = await Promise.all([
        listCheckIns(lastG),
        listSessionLogsRange(lastG, lastG),
      ])
      // 不看是誰點的名：只要該班沒填，同工（全班別）與該班老師都要收到提醒
      const missing = classesMissingLog(checks, logs, (id) => auth.can('admin') || auth.canClass(id))
      if (missing.length > 0 && classGroups.value.length === 0) {
        classGroups.value = await listClassGroups()
      }
      missingLogClasses.value = missing.map((id) => ({
        id,
        name: classGroups.value.find((g) => g.id === id)?.name ?? '',
      }))
    }
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

// ---- 管理端：公告發布/編輯/刪除 ----
const editingAnn = ref<Announcement | 'new' | null>(null)
const annDraft = ref<{
  title: string
  body: string
  tag: string
  class_group_id: string | null
  pinned: boolean
}>({ title: '', body: '', tag: CATEGORY_DEFAULT, class_group_id: null, pinned: false })
const annSaving = ref(false)

function openAnnEditor(a: Announcement | null) {
  if (a ? !canEditAnn(a) : !canPostAnn.value) return
  editingAnn.value = a ?? 'new'
  annDraft.value = a
    ? { title: a.title, body: a.body, tag: a.tag, class_group_id: a.class_group_id, pinned: a.pinned }
    : {
        title: '',
        body: '',
        tag: CATEGORY_DEFAULT,
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
      <div class="greet" @click="$router.push({ name: 'me' })">
        <h2>平安，{{ auth.profile?.display_name ?? '' }} 👋</h2>
        <p class="hint">{{ new Date().toLocaleDateString('zh-TW') }}・點這裡可修改稱呼</p>
      </div>
      <div class="role-tags">
        <van-tag
          v-for="r in auth.roles"
          :key="r"
          round
          size="medium"
          :style="roleTagStyle(r)"
        >
          {{ roleLabel(r) }}
        </van-tag>
      </div>
    </header>

    <van-notice-bar
      v-if="auth.profile && !auth.isApproved"
      left-icon="clock-o"
      color="var(--kll-primary-text)"
      background="var(--kll-primary-soft)"
      :text="pendingText"
    />

    <!-- 指名是哪一班還沒填，並直接跳到該班（v9 驗收回饋：同班已有人填就不該再提醒） -->
    <van-notice-bar
      v-if="missingLogClasses.length > 0"
      left-icon="edit"
      mode="link"
      color="var(--kll-orange-text)"
      background="var(--kll-orange-soft)"
      :text="`上堂課（${lastG}）${missingLogClasses.map((c) => c.name).join('、')}的課堂紀錄還沒填——${feedbackDue.toLocaleDateString('zh-TW')}（${weekdayName(feedbackDue)}）23:59 前完成`"
      @click="$router.push({ name: 'class-log', query: { class: missingLogClasses[0].id } })"
    />

    <van-notice-bar
      v-if="needPlan"
      left-icon="todo-list-o"
      mode="link"
      color="var(--kll-green-text)"
      background="var(--kll-green-soft)"
      :text="`本週出席還沒填喔——${weekdayName(deadline)} 23:59 前完成勾選`"
      @click="$router.push({ name: 'attendance' })"
    />

    <van-notice-bar
      v-if="overdueItems > 0"
      left-icon="warning-o"
      mode="link"
      color="var(--kll-pink-text)"
      background="var(--kll-pink-soft)"
      :text="`會議待辦有 ${overdueItems} 項已逾期——點我查看`"
      @click="$router.push({ name: 'meetings' })"
    />

    <van-notice-bar
      v-if="lessonStatus && lessonStatus.filled > 0"
      left-icon="notes-o"
      mode="link"
      color="var(--kll-primary-text)"
      background="var(--kll-primary-soft)"
      :text="`本週教案：${lessonStatus.filled}/${lessonStatus.total} 班已填寫——點我查看`"
      @click="$router.push({ name: 'lesson-plans' })"
    />

    <van-notice-bar
      v-if="kidServiceDates.length > 0"
      left-icon="smile-o"
      mode="link"
      color="var(--kll-orange-text)"
      background="var(--kll-orange-soft)"
      :text="`您的孩子有服事安排（${kidServiceDates.map((d) => d.slice(5).replace('-', '/')).join('、')}）——點日期到出席頁查看服事表`"
      @click="$router.push({ name: 'attendance' })"
    />

    <van-notice-bar
      v-if="myServiceDates.length > 0"
      left-icon="calendar-o"
      mode="link"
      color="var(--kll-green-text)"
      background="var(--kll-green-soft)"
      :text="`您有已發布的服事安排（${myServiceDates.map((d) => d.slice(5).replace('-', '/')).join('、')}）——點我查看服事表`"
      @click="$router.push({ name: 'service' })"
    />


    <div class="section-row">
      <h3 class="section-title" style="--sec: var(--kll-pink)">兒童牧區公告</h3>
      <van-button v-if="canPostAnn" size="small" type="primary" plain @click="openAnnEditor(null)">
        ＋發布
      </van-button>
    </div>
    <van-skeleton v-if="loading" title :row="3" />
    <template v-else>
      <!-- 分類篩選（v0.3.2）：只有一種分類時不出現，比照教材資料庫 -->
      <div v-if="annFilterVisible" class="ann-filter">
        <van-tag
          round
          size="large"
          :type="annCategory === CATEGORY_ALL ? 'primary' : 'default'"
          :plain="annCategory !== CATEGORY_ALL"
          @click="annCategory = CATEGORY_ALL"
        >
          全部
        </van-tag>
        <van-tag
          v-for="c in ANNOUNCEMENT_CATEGORIES"
          :key="c"
          round
          size="large"
          :type="annCategory === c ? 'primary' : 'default'"
          :plain="annCategory !== c"
          @click="annCategory = annCategory === c ? CATEGORY_ALL : c"
        >
          {{ categoryIcon(c) }} {{ c }}
        </van-tag>
      </div>

      <div v-if="shownAnns.length === 0" class="card hint">
        {{ announcements.length === 0 ? '目前沒有公告' : `目前沒有${annCategory}公告` }}
      </div>
      <div
        v-for="a in shownAnns"
        :key="a.id"
        class="card"
        :class="{ clickable: canEditAnn(a) }"
        @click="openAnnEditor(a)"
      >
        <!-- 標籤自成一列：手機上標題與標籤同列時，標題會被擠到換行且與標籤錯位 -->
        <div class="ann-head">
          <van-tag :style="categoryStyle(a.tag)">{{ categoryIcon(a.tag) }} {{ a.tag }}</van-tag>
          <van-tag v-if="a.class_group_id" :style="classTagStyle(a.class_groups?.name)">
            {{ a.class_groups?.name ?? '班別' }}
          </van-tag>
          <span v-if="a.pinned" class="ann-pin">📌</span>
        </div>
        <strong class="ann-title">{{ a.title }}</strong>
        <!-- 內文網址轉成可點連結；不用 v-html，避免使用者輸入變成可執行標記。
             @click.stop：卡片本身是編輯入口，點連結不該同時開啟編輯 -->
        <p class="ann-body">
          <template v-for="(seg, i) in linkifyText(a.body)" :key="i">
            <a
              v-if="seg.href"
              :href="seg.href"
              target="_blank"
              rel="noopener noreferrer"
              class="ann-link"
              @click.stop
            >{{ seg.text }}</a>
            <template v-else>{{ seg.text }}</template>
          </template>
        </p>
        <p class="hint">{{ announcementDateText(a.created_at, a.updated_at) }}</p>
      </div>
    </template>

    <van-popup
      :show="editingAnn !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editingAnn = null)"
    >
      <div class="ann-editor">
        <h3>{{ editingAnn === 'new' ? '發布公告' : '編輯公告' }}</h3>
        <!-- v9 #7：標籤在上、輸入框整寬，文字從左緣開始（原本標籤佔左半邊，輸入區被擠到右側） -->
        <van-field v-model="annDraft.title" label="標題" label-align="top" maxlength="60"
          placeholder="例：下次聚會合班敬拜通知" />
        <van-field v-model="annDraft.body" label="內容" label-align="top" type="textarea" rows="3"
          autosize maxlength="1000" placeholder="公告內容" />
        <van-cell title="對象" center class="tag-cell">
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
        <van-cell title="分類" center class="tag-cell">
          <template #value>
            <van-tag
              v-for="t in ANNOUNCEMENT_CATEGORIES"
              :key="t"
              round
              size="large"
              class="tag-opt"
              :type="annDraft.tag === t ? 'primary' : 'default'"
              :plain="annDraft.tag !== t"
              @click="annDraft.tag = t"
            >
              {{ categoryIcon(t) }} {{ t }}
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.top h2 {
  margin: 0;
  font-size: 25px;
}
.greet {
  cursor: pointer;
}
/* 窄螢幕（iPhone SE）：多角色標籤允許換行，不擠壓標題 */
.role-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
  max-width: 40%;
}
.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ann-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 2px 10px;
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
  margin: 0;
}
/*
 * 窄螢幕（iPhone SE）：選項標籤允許換行，避免溢出。
 * 只套在「對象/標籤」這兩列——van-field 的容器也帶 .van-cell__value，
 * 先前沒限定範圍，連標題/內容的輸入框都被 justify-content: flex-end 推到右邊（v9 #7）。
 */
.ann-editor :deep(.tag-cell .van-cell__value) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
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
  margin-bottom: 6px;
}
.ann-pin {
  margin-left: auto;
}
.ann-title {
  display: block;
  font-size: 21px;
  line-height: 1.4;
}
.ann-link {
  color: var(--kll-primary);
  text-decoration: underline;
  word-break: break-all;
}
.ann-body {
  font-size: 18px;
  color: var(--kll-sub);
  margin: 8px 0;
  white-space: pre-wrap;
}
</style>
