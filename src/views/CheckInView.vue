<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showFailToast } from 'vant'
import { listPlans } from '../api/attendance'
import {
  checkIn,
  listCheckIns,
  listClassChildren,
  listClassGroups,
  undoCheckIn,
} from '../api/checkin'
import { formatSunday, upcomingSunday } from '../lib/sunday'
import type { Child, ClassGroup } from '../types'

const sunday = upcomingSunday()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const children = ref<Child[]>([])
/** child_id -> 已預先勾選出席 */
const plannedSet = ref(new Set<string>())
/** child_id -> 已簽到 */
const checkedSet = ref(new Set<string>())
const loading = ref(true)

const stats = computed(() => {
  const planned = children.value.filter((c) => plannedSet.value.has(c.id))
  const checked = children.value.filter((c) => checkedSet.value.has(c.id))
  const walkIn = checked.filter((c) => !plannedSet.value.has(c.id))
  return { planned: planned.length, checked: checked.length, walkIn: walkIn.length }
})

/** 排序：預先報名在前，再按名字 */
const sortedChildren = computed(() =>
  [...children.value].sort((a, b) => {
    const pa = plannedSet.value.has(a.id) ? 0 : 1
    const pb = plannedSet.value.has(b.id) ? 0 : 1
    return pa - pb || a.name.localeCompare(b.name, 'zh-TW')
  }),
)

async function loadClass() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    const [kids, plans, checks] = await Promise.all([
      listClassChildren(activeGroup.value),
      listPlans(sunday),
      listCheckIns(sunday),
    ])
    children.value = kids
    plannedSet.value = new Set(plans.filter((p) => p.status === 'attending').map((p) => p.child_id))
    checkedSet.value = new Set(checks.map((c) => c.child_id))
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

async function toggle(child: Child) {
  const was = checkedSet.value.has(child.id)
  // 樂觀更新，失敗再還原
  const next = new Set(checkedSet.value)
  if (was) next.delete(child.id)
  else next.add(child.id)
  checkedSet.value = next
  try {
    if (was) await undoCheckIn(child.id, sunday)
    else await checkIn(child.id, sunday, !plannedSet.value.has(child.id))
  } catch (e) {
    const revert = new Set(checkedSet.value)
    if (was) revert.add(child.id)
    else revert.delete(child.id)
    checkedSet.value = revert
    showFailToast((e as Error).message)
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
      <div class="stat card"><strong>{{ stats.checked }}</strong><span class="hint">已簽到</span></div>
      <div class="stat card"><strong>{{ stats.walkIn }}</strong><span class="hint">現場加入</span></div>
    </div>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="children.length === 0" class="card hint">此班別尚無孩子名單</div>
      <div
        v-for="c in sortedChildren"
        :key="c.id"
        class="card row"
        @click="toggle(c)"
      >
        <div class="info">
          <strong>{{ c.name }}</strong>
          <span class="hint" :class="{ walkin: !plannedSet.has(c.id) }">
            {{ plannedSet.has(c.id) ? '家長已預先勾選出席' : '未預先報名（現場加入）' }}
          </span>
        </div>
        <van-checkbox :model-value="checkedSet.has(c.id)" @click.stop="toggle(c)" />
      </div>
    </template>
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
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.walkin {
  color: var(--kll-amber);
}
</style>
