<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listPlans } from '../api/attendance'
import {
  listCheckIns,
  listChildCheckIns,
  listChildScores,
  listClassChildren,
  listClassGroups,
  listFeedback,
  listScores,
  removeCheckIn,
  upsertCheckIn,
  upsertFeedback,
  upsertScore,
} from '../api/checkin'
import { listAllChildren } from '../api/records'
import { updateChild } from '../api/roster'
import { MOOD_OPTIONS, moodKey } from '../lib/moods'
import { SCORE_DEFAULT, classHasIndex } from '../lib/performance'
import { formatGathering, recordsRangeStart, upcomingGathering } from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type {
  AttendancePlan,
  CheckIn,
  CheckInStatus,
  Child,
  ClassGroup,
  PerformanceScore,
} from '../types'

const auth = useAuthStore()
const gathering = upcomingGathering()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const children = ref<Child[]>([])
/** 全校名冊（現場加入挑人＋跨班加入者顯示姓名用） */
const allChildren = ref<Child[]>([])
const planMap = ref(new Map<string, AttendancePlan>())
const checkMap = ref(new Map<string, CheckIn>())
const moodsMap = ref(new Map<string, string[]>())
const scoreMap = ref(new Map<string, { focus: number | null; cooperation: number | null }>())
const loading = ref(true)

/** 幼幼班點名不顯示指數列（v4 決議 2） */
const showIndex = computed(() =>
  classHasIndex(groups.value.find((g) => g.id === activeGroup.value)?.name),
)

/** 跨班現場加入者：當日簽到記在本班、但不在本班名冊 → 由資料推導，重載不消失 */
const extras = computed<Child[]>(() => {
  const inRoster = new Set(children.value.map((c) => c.id))
  const byId = new Map(allChildren.value.map((c) => [c.id, c]))
  const list: Child[] = []
  for (const [childId, check] of checkMap.value) {
    if (check.class_group_id === activeGroup.value && !inRoster.has(childId)) {
      const child = byId.get(childId)
      if (child) list.push(child)
    }
  }
  return list
})

const displayChildren = computed(() => [...children.value, ...extras.value])

const stats = computed(() => {
  const ids = displayChildren.value.map((c) => c.id)
  const planned = ids.filter((id) => planMap.value.get(id)?.status === 'attending')
  const present = ids.filter((id) => checkMap.value.get(id)?.status === 'present')
  const leave = ids.filter((id) => checkMap.value.get(id)?.status === 'leave')
  return { planned: planned.length, present: present.length, leave: leave.length }
})

/** 排序：預先報名出席在前，再按名字；現場加入者殿後 */
const sortedChildren = computed(() => {
  const inRoster = new Set(children.value.map((c) => c.id))
  return [...displayChildren.value].sort((a, b) => {
    const ra = inRoster.has(a.id) ? 0 : 1
    const rb = inRoster.has(b.id) ? 0 : 1
    const pa = planMap.value.get(a.id)?.status === 'attending' ? 0 : 1
    const pb = planMap.value.get(b.id)?.status === 'attending' ? 0 : 1
    return ra - rb || pa - pb || a.name.localeCompare(b.name, 'zh-TW')
  })
})

async function loadClass() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    const [kids, plans, checks, feedback, scores] = await Promise.all([
      listClassChildren(activeGroup.value),
      listPlans(gathering),
      listCheckIns(gathering),
      listFeedback(gathering),
      listScores(gathering),
    ])
    children.value = kids
    planMap.value = new Map(plans.map((p) => [p.child_id, p]))
    checkMap.value = new Map(checks.map((c) => [c.child_id, c]))
    moodsMap.value = new Map(feedback.map((f) => [f.child_id, f.moods]))
    scoreMap.value = new Map(
      scores.map((s) => [s.child_id, { focus: s.focus, cooperation: s.cooperation }]),
    )
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    // 老師標籤班別化：只顯示自己被指派的班別
    const [allGroups, kids] = await Promise.all([listClassGroups(), listAllChildren()])
    groups.value = allGroups.filter((g) => auth.canClass(g.id))
    allChildren.value = kids
    activeGroup.value = groups.value[0]?.id ?? ''
    if (!activeGroup.value) loading.value = false
  } catch (e) {
    showFailToast((e as Error).message)
    loading.value = false
  }
})

watch(activeGroup, loadClass)

function isWalkIn(childId: string): boolean {
  return planMap.value.get(childId)?.status !== 'attending'
}

/** 點同一狀態＝取消（回未處理）；點另一狀態＝切換 */
async function setStatus(child: Child, target: CheckInStatus) {
  const current = checkMap.value.get(child.id)
  try {
    if (current?.status === target) {
      await removeCheckIn(child.id, gathering)
      const next = new Map(checkMap.value)
      next.delete(child.id)
      checkMap.value = next
    } else {
      const entry = {
        child_id: child.id,
        class_group_id: current?.class_group_id ?? activeGroup.value,
        gathering_date: gathering,
        status: target,
        note: current?.note ?? null,
        is_walk_in: isWalkIn(child.id),
      }
      await upsertCheckIn(entry)
      const next = new Map(checkMap.value)
      next.set(child.id, { ...(current ?? { id: '', checked_by: '' }), ...entry } as CheckIn)
      checkMap.value = next
    }
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

/** 專心度/配合度：兩維 1–5，點同一格＝取消；另一維未設定時以預設 5 帶入（PRD） */
async function markScore(child: Child, dim: 'focus' | 'cooperation', value: number) {
  const cur = scoreMap.value.get(child.id)
  const next = {
    focus: cur?.focus ?? null,
    cooperation: cur?.cooperation ?? null,
  }
  next[dim] = next[dim] === value ? null : value
  const other = dim === 'focus' ? 'cooperation' : 'focus'
  if (next[dim] != null && next[other] == null) next[other] = SCORE_DEFAULT
  try {
    await upsertScore(child.id, gathering, next.focus, next.cooperation)
    const map = new Map(scoreMap.value)
    map.set(child.id, next)
    scoreMap.value = map
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

// ---- 詳情編輯（表情回饋＋老師交接備註）----
const editing = ref<Child | null>(null)
const draftMoods = ref<string[]>([])
const draftNote = ref('')
const savingDetail = ref(false)

function openDetail(child: Child) {
  editing.value = child
  draftMoods.value = [...(moodsMap.value.get(child.id) ?? [])]
  draftNote.value = checkMap.value.get(child.id)?.note ?? ''
}

function toggleMood(key: string) {
  draftMoods.value = draftMoods.value.includes(key)
    ? draftMoods.value.filter((m) => m !== key)
    : [...draftMoods.value, key]
}

async function saveDetail() {
  const child = editing.value
  if (!child) return
  savingDetail.value = true
  try {
    await upsertFeedback(child.id, gathering, draftMoods.value)
    const nextMoods = new Map(moodsMap.value)
    nextMoods.set(child.id, [...draftMoods.value])
    moodsMap.value = nextMoods

    const note = draftNote.value.trim() || null
    const current = checkMap.value.get(child.id)
    // 備註跟著當日紀錄走：尚未簽到/請假時，先以「出席」建立紀錄
    const entry = {
      child_id: child.id,
      class_group_id: current?.class_group_id ?? activeGroup.value,
      gathering_date: gathering,
      status: current?.status ?? 'present',
      note,
      is_walk_in: current?.is_walk_in ?? isWalkIn(child.id),
    }
    await upsertCheckIn(entry)
    const nextChecks = new Map(checkMap.value)
    nextChecks.set(child.id, { ...(current ?? { id: '', checked_by: '' }), ...entry } as CheckIn)
    checkMap.value = nextChecks

    showSuccessToast('已儲存')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingDetail.value = false
  }
}

// ---- 近三個月個人走勢（T-KID-02f：出席＋指數＋備註）----
const historyChild = ref<Child | null>(null)
const historyRows = ref<{ date: string; check?: CheckIn; score?: PerformanceScore }[]>([])
const historyLoading = ref(false)
const historyFrom = recordsRangeStart(new Date(), 3)

async function openHistory(child: Child) {
  historyChild.value = child
  historyLoading.value = true
  historyRows.value = []
  try {
    const [checks, scores] = await Promise.all([
      listChildCheckIns(child.id, historyFrom, gathering),
      listChildScores(child.id, historyFrom, gathering),
    ])
    const dates = [...new Set([...checks, ...scores].map((r) => r.gathering_date))].sort((a, b) =>
      b.localeCompare(a),
    )
    const checkBy = new Map(checks.map((c) => [c.gathering_date, c]))
    const scoreBy = new Map(scores.map((s) => [s.gathering_date, s]))
    historyRows.value = dates.map((date) => ({
      date,
      check: checkBy.get(date),
      score: scoreBy.get(date),
    }))
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    historyLoading.value = false
  }
}

// ---- 現場加入：僅能從全校名冊挑人（v4 決議 5：不開放老師新增建檔）----
const picking = ref(false)
const pickKeyword = ref('')

function openPicker() {
  picking.value = true
  pickKeyword.value = ''
}

const pickCandidates = computed(() => {
  const shown = new Set(displayChildren.value.map((c) => c.id))
  const kw = pickKeyword.value.trim()
  return allChildren.value
    .filter((c) => !shown.has(c.id))
    .filter((c) => !kw || c.name.includes(kw))
})

/** 升班（如幼幼班→幼童班）：正式把孩子轉入本班名冊（同工權限；RLS 強制） */
async function promoteChild(child: Child) {
  try {
    await updateChild(child.id, { name: child.name, class_group_id: activeGroup.value })
    allChildren.value = await listAllChildren()
    await loadClass()
    picking.value = false
    showSuccessToast(`${child.name} 已轉入本班名冊`)
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

async function pickChild(child: Child) {
  try {
    await upsertCheckIn({
      child_id: child.id,
      class_group_id: activeGroup.value, // 點名記在「加入的班」，重載後仍顯示於此班
      gathering_date: gathering,
      status: 'present',
      note: null,
      is_walk_in: true,
    })
    const next = new Map(checkMap.value)
    next.set(child.id, {
      id: '',
      checked_by: '',
      child_id: child.id,
      class_group_id: activeGroup.value,
      gathering_date: gathering,
      status: 'present',
      note: null,
      is_walk_in: true,
    } as CheckIn)
    checkMap.value = next
    picking.value = false
    showSuccessToast(`${child.name} 已加入本日點名，並寫入出席紀錄`)
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <header class="top">
      <h2>主日點名</h2>
      <span class="hint">{{ formatGathering(gathering) }}</span>
    </header>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <div class="stats">
      <div class="stat card"><strong>{{ stats.planned }}</strong><span class="hint">預計出席</span></div>
      <div class="stat card"><strong>{{ stats.present }}</strong><span class="hint">已簽到</span></div>
      <div class="stat card"><strong>{{ stats.leave }}</strong><span class="hint">臨時請假</span></div>
    </div>

    <div v-if="groups.length === 0" class="card hint">
      您尚未被指派任何班別，請聯繫核心同工於名單頁設定
    </div>
    <van-skeleton v-else-if="loading" title :row="5" />
    <template v-else>
      <div v-if="displayChildren.length === 0" class="card hint">此班別尚無孩子名單</div>
      <div v-for="c in sortedChildren" :key="c.id" class="card kid-card">
        <div class="kid-main">
          <div class="info">
            <strong class="kid-name" @click="openHistory(c)">
              {{ c.name }}
              <van-tag v-if="c.class_group_id !== activeGroup" plain type="warning" class="cross-tag">
                {{ c.class_groups?.name ?? '他班' }}
              </van-tag>
              ›
            </strong>
            <span class="hint" :class="{ walkin: isWalkIn(c.id) }">
              {{ planMap.get(c.id)?.status === 'attending' ? '家長已預先勾選出席'
                : planMap.get(c.id)?.status === 'leave' ? '家長已請假'
                : '未預先報名' }}
            </span>
          </div>
          <div class="actions">
            <van-button
              size="small"
              :type="checkMap.get(c.id)?.status === 'present' ? 'primary' : 'default'"
              @click="setStatus(c, 'present')"
            >
              簽到
            </van-button>
            <van-button
              size="small"
              :type="checkMap.get(c.id)?.status === 'leave' ? 'warning' : 'default'"
              @click="setStatus(c, 'leave')"
            >
              請假
            </van-button>
            <van-button size="small" plain type="primary" @click="openDetail(c)">紀錄</van-button>
          </div>
        </div>
        <template v-if="showIndex">
          <div v-for="dim in (['focus', 'cooperation'] as const)" :key="dim" class="score-row">
            <span class="score-label">{{ dim === 'focus' ? '專心' : '配合' }}</span>
            <button
              v-for="v in [1, 2, 3, 4, 5]"
              :key="v"
              type="button"
              class="score-btn"
              :class="{ on: scoreMap.get(c.id)?.[dim] === v }"
              @click="markScore(c, dim, v)"
            >
              {{ v }}
            </button>
          </div>
        </template>
        <p v-if="planMap.get(c.id)?.note" class="parent-note">
          💬 家長：{{ planMap.get(c.id)?.note }}
        </p>
        <p v-if="(moodsMap.get(c.id) ?? []).length" class="moods">
          {{ (moodsMap.get(c.id) ?? []).join('、') }}
        </p>
        <p v-if="checkMap.get(c.id)?.note" class="teacher-note">
          📝 {{ checkMap.get(c.id)?.note }}
        </p>
      </div>

      <van-button round block plain type="primary" class="walkin-btn" @click="openPicker">
        ＋ 現場加入（從全校名冊挑選）
      </van-button>

      <p v-if="displayChildren.length > 0" class="hint idx-note">
        ※ 專心/配合指數僅老師與同工可見；表情標籤會顯示給該孩子的家長；
        「紀錄」內的文字備註僅老師可見。{{ showIndex ? '' : '幼幼班不評指數。' }}
        點孩子姓名可看近三個月走勢。
      </p>
    </template>

    <!-- 表情回饋＋老師備註 -->
    <van-popup
      :show="editing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor" v-if="editing">
        <h3>{{ editing.name }} 的課堂紀錄</h3>
        <p class="hint">課堂表現（家長看得到，取代成績的鼓勵回饋）</p>
        <div class="mood-grid">
          <van-tag
            v-for="m in MOOD_OPTIONS"
            :key="m.label"
            round
            size="large"
            :type="draftMoods.includes(moodKey(m)) ? 'primary' : 'default'"
            :plain="!draftMoods.includes(moodKey(m))"
            @click="toggleMood(moodKey(m))"
          >
            {{ m.emoji }} {{ m.label }}
          </van-tag>
        </div>
        <p class="hint">老師交接備註（僅老師可見，家長不會看到）</p>
        <van-field
          v-model="draftNote"
          type="textarea"
          rows="2"
          autosize
          maxlength="300"
          placeholder="例：今天情緒比較低落，下週請多留意"
          class="note-field"
        />
        <van-button round block type="primary" :loading="savingDetail" @click="saveDetail">
          儲存
        </van-button>
      </div>
    </van-popup>

    <!-- 近三個月個人走勢（僅老師/同工） -->
    <van-popup
      :show="historyChild !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (historyChild = null)"
    >
      <div class="editor" v-if="historyChild">
        <h3>{{ historyChild.name }} · 近三個月</h3>
        <p class="hint">出席、專心/配合與老師備註（僅老師與同工可見）</p>
        <van-skeleton v-if="historyLoading" title :row="4" />
        <template v-else>
          <p v-if="historyRows.length === 0" class="hint center">此區間尚無紀錄</p>
          <div v-for="r in historyRows" :key="r.date" class="hist-row">
            <div class="hist-head">
              <strong>{{ r.date }}</strong>
              <van-tag
                v-if="r.check"
                size="medium"
                :type="r.check.status === 'present' ? 'success' : 'warning'"
              >
                {{ r.check.status === 'present' ? '簽到' : '臨時請假' }}
              </van-tag>
              <span v-if="r.score" class="hint">
                專心 {{ r.score.focus ?? '–' }}・配合 {{ r.score.cooperation ?? '–' }}
              </span>
            </div>
            <p v-if="r.check?.note" class="hint">📝 {{ r.check.note }}</p>
          </div>
        </template>
      </div>
    </van-popup>

    <!-- 現場加入：全校名冊挑人 -->
    <van-popup
      :show="picking"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (picking = false)"
    >
      <div class="editor">
        <h3>現場加入</h3>
        <p class="hint">
          僅能從全校名冊挑選；名冊沒有的孩子請聯繫同工於名單頁建檔。
          「今日加入」＝只算這一天；孩子若已<b>升班</b>（如幼幼班→幼童班），
          請用「轉入本班」正式調整班別{{ auth.can('admin') ? '' : '（需同工權限，請聯繫同工）' }}。
        </p>
        <van-field v-model="pickKeyword" placeholder="搜尋姓名⋯" clearable class="pick-search" />
        <p v-if="pickCandidates.length === 0" class="hint center">找不到符合的孩子</p>
        <div v-for="c in pickCandidates.slice(0, 30)" :key="c.id" class="pick-row">
          <div class="pick-info">
            <strong>{{ c.name }}</strong>
            <van-tag plain type="primary">{{ c.class_groups?.name ?? '' }}</van-tag>
          </div>
          <div class="pick-actions">
            <van-button size="small" plain type="primary" @click="pickChild(c)">今日加入</van-button>
            <van-button v-if="auth.can('admin')" size="small" type="primary" @click="promoteChild(c)">
              轉入本班
            </van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.top h2 {
  margin: 0 0 8px;
  font-size: 25px;
}
.tabs {
  margin-bottom: 12px;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat strong {
  font-size: 28px;
}
.kid-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.kid-name {
  cursor: pointer;
}
.cross-tag {
  margin-left: 4px;
  vertical-align: 2px;
}
.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.walkin {
  color: var(--kll-amber);
}
.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.score-label {
  width: 44px;
  font-size: 15px;
  color: var(--kll-sub);
}
.score-btn {
  width: 44px;
  height: 40px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--kll-bg);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--kll-text);
}
.score-btn.on {
  background: var(--kll-primary);
  border-color: var(--kll-primary);
  color: #fff;
  font-weight: 700;
}
.parent-note,
.moods,
.teacher-note {
  margin: 8px 0 0;
  font-size: 17px;
  border-radius: 8px;
  padding: 6px 10px;
}
.parent-note {
  background: var(--kll-primary-soft);
}
.moods {
  background: var(--kll-amber-soft);
}
.teacher-note {
  background: var(--kll-bg);
  color: var(--kll-sub);
}
.walkin-btn {
  margin: 14px 0 0;
}
.idx-note {
  margin-top: 12px;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 4px;
  font-size: 22px;
  text-align: center;
}
.editor .hint {
  margin: 10px 0 8px;
}
.center {
  text-align: center;
}
.mood-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.note-field {
  background: var(--kll-bg);
  border-radius: 10px;
  margin-bottom: 14px;
}
.hist-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--kll-bg);
}
.hist-row:last-child {
  border-bottom: none;
}
.hist-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.hist-row p {
  margin: 6px 0 0;
}
.pick-search {
  background: var(--kll-bg);
  border-radius: 10px;
  margin-bottom: 10px;
}
.pick-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--kll-bg);
}
.pick-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pick-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.pick-row:last-child {
  border-bottom: none;
}
</style>
