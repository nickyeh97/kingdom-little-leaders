<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listPlans } from '../api/attendance'
import {
  listCheckIns,
  listClassChildren,
  listClassGroups,
  listFeedback,
  removeCheckIn,
  upsertCheckIn,
  upsertFeedback,
} from '../api/checkin'
import { MOOD_OPTIONS, moodKey } from '../lib/moods'
import { formatSunday, upcomingSunday } from '../lib/sunday'
import type { AttendancePlan, CheckIn, CheckInStatus, Child, ClassGroup } from '../types'

const sunday = upcomingSunday()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const children = ref<Child[]>([])
const planMap = ref(new Map<string, AttendancePlan>())
const checkMap = ref(new Map<string, CheckIn>())
const moodsMap = ref(new Map<string, string[]>())
const loading = ref(true)

const stats = computed(() => {
  const ids = children.value.map((c) => c.id)
  const planned = ids.filter((id) => planMap.value.get(id)?.status === 'attending')
  const present = ids.filter((id) => checkMap.value.get(id)?.status === 'present')
  const leave = ids.filter((id) => checkMap.value.get(id)?.status === 'leave')
  return { planned: planned.length, present: present.length, leave: leave.length }
})

/** 排序：預先報名出席在前，再按名字 */
const sortedChildren = computed(() =>
  [...children.value].sort((a, b) => {
    const pa = planMap.value.get(a.id)?.status === 'attending' ? 0 : 1
    const pb = planMap.value.get(b.id)?.status === 'attending' ? 0 : 1
    return pa - pb || a.name.localeCompare(b.name, 'zh-TW')
  }),
)

async function loadClass() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    const [kids, plans, checks, feedback] = await Promise.all([
      listClassChildren(activeGroup.value),
      listPlans(sunday),
      listCheckIns(sunday),
      listFeedback(sunday),
    ])
    children.value = kids
    planMap.value = new Map(plans.map((p) => [p.child_id, p]))
    checkMap.value = new Map(checks.map((c) => [c.child_id, c]))
    moodsMap.value = new Map(feedback.map((f) => [f.child_id, f.moods]))
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    groups.value = await listClassGroups()
    activeGroup.value = groups.value[0]?.id ?? ''
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
      await removeCheckIn(child.id, sunday)
      const next = new Map(checkMap.value)
      next.delete(child.id)
      checkMap.value = next
    } else {
      const entry = {
        child_id: child.id,
        sunday_date: sunday,
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
    await upsertFeedback(child.id, sunday, draftMoods.value)
    const nextMoods = new Map(moodsMap.value)
    nextMoods.set(child.id, [...draftMoods.value])
    moodsMap.value = nextMoods

    const note = draftNote.value.trim() || null
    const current = checkMap.value.get(child.id)
    // 備註跟著當日紀錄走：尚未簽到/請假時，先以「出席」建立紀錄
    const entry = {
      child_id: child.id,
      sunday_date: sunday,
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
</script>

<template>
  <div class="page">
    <header class="top">
      <h2>主日點名</h2>
      <span class="hint">{{ formatSunday(sunday) }}</span>
    </header>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <div class="stats">
      <div class="stat card"><strong>{{ stats.planned }}</strong><span class="hint">預計出席</span></div>
      <div class="stat card"><strong>{{ stats.present }}</strong><span class="hint">已簽到</span></div>
      <div class="stat card"><strong>{{ stats.leave }}</strong><span class="hint">臨時請假</span></div>
    </div>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="children.length === 0" class="card hint">此班別尚無孩子名單</div>
      <div v-for="c in sortedChildren" :key="c.id" class="card kid-card">
        <div class="kid-main">
          <div class="info">
            <strong>{{ c.name }}</strong>
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
    </template>

    <van-popup
      :show="editing !== null"
      round
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
  font-size: 18px;
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
  font-size: 20px;
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
.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.walkin {
  color: var(--kll-amber);
}
.parent-note,
.moods,
.teacher-note {
  margin: 8px 0 0;
  font-size: 12px;
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
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 4px;
  font-size: 16px;
  text-align: center;
}
.editor .hint {
  margin: 10px 0 8px;
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
</style>
