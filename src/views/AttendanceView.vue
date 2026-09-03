<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listMyChildren, listPlansRange, upsertPlans } from '../api/attendance'
import {
  addChildSignup,
  listChildPermissions,
  listChildRosters,
  listChildSignups,
  removeChildSignup,
} from '../api/childService'
import { addMonths, monthGrid, monthOf, monthRange, monthTitle } from '../lib/calendar'
import { WEEKDAY_NAMES } from '../lib/config'
import { classTagStyle } from '../lib/classColor'
import {
  formatGathering,
  isPlanOpen,
  planDeadline,
  upcomingGathering,
  weekdayName,
} from '../lib/gathering'
import type {
  AttendancePlan,
  AttendanceStatus,
  Child,
  ChildServicePermission,
  ChildServiceRoster,
  ChildServiceSignup,
} from '../types'

/** 本週與未來聚會日皆可填寫（v5 #0）；各週依各自截止日鎖定，過去唯讀 */
const gathering = upcomingGathering()
const open = isPlanOpen(gathering)
const deadline = planDeadline(gathering)

const anchor = ref(monthOf(gathering))
const selected = ref(gathering)

const children = ref<Child[]>([])
const monthPlans = ref<AttendancePlan[]>([])
const childSignups = ref<ChildServiceSignup[]>([])
const childRosters = ref<ChildServiceRoster[]>([])
const childPerms = ref<ChildServicePermission[]>([])
const statusMap = ref<Record<string, AttendanceStatus>>({})
const noteMap = ref<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)

const options: { value: AttendanceStatus; label: string }[] = [
  { value: 'attending', label: '出席' },
  { value: 'leave', label: '請假' },
  { value: 'undecided', label: '未定' },
]
const planLabel: Record<AttendanceStatus, string> = {
  attending: '出席',
  leave: '請假',
  undecided: '未定',
}

const cells = computed(() => monthGrid(anchor.value))

/** 「日期|孩子」→ 該筆預先出席（供月曆點點與歷史唯讀呈現） */
const planAt = computed(() => {
  const map = new Map<string, AttendancePlan>()
  for (const p of monthPlans.value) map.set(`${p.gathering_date}|${p.child_id}`, p)
  return map
})

/** 選到的日期屬於哪種呈現：本週/未來可填寫（v5 #0）；過去唯讀 */
const mode = computed<'edit' | 'past'>(() =>
  selected.value >= gathering ? 'edit' : 'past',
)
/** 選定週各自的截止狀態與截止日 */
const openSel = computed(() => isPlanOpen(selected.value))
const deadlineSel = computed(() => planDeadline(selected.value))

const attendingCount = computed(
  () => Object.values(statusMap.value).filter((s) => s === 'attending').length,
)

function dotClass(date: string, childId: string): string {
  const status = planAt.value.get(`${date}|${childId}`)?.status
  return status === 'attending' ? 'dot-attend' : status === 'leave' ? 'dot-leave' : 'dot-none'
}

async function loadMonth() {
  const { from, to } = monthRange(anchor.value)
  ;[monthPlans.value, childSignups.value, childRosters.value] = await Promise.all([
    listPlansRange(from, to),
    listChildSignups(from, to),
    listChildRosters(from, to),
  ])
}

/** 以既有資料帶入選定週的可編輯狀態（預設維持「未定」——v3 決議） */
function seedEditable() {
  for (const kid of children.value) {
    const p = planAt.value.get(`${selected.value}|${kid.id}`)
    statusMap.value[kid.id] = p?.status ?? 'undecided'
    noteMap.value[kid.id] = p?.note ?? ''
  }
}

onMounted(async () => {
  try {
    // 授權清單（RLS：只拿得到自己孩子的）——家長端僅顯示已開通項目（v5 #3）
    ;[children.value, childPerms.value] = await Promise.all([
      listMyChildren(),
      listChildPermissions(),
    ])
    await loadMonth()
    seedEditable()
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

watch(anchor, () => {
  loadMonth().catch((e) => showFailToast((e as Error).message))
})

// 切換週次時，重新帶入該週已填的內容（未儲存的修改不保留）
watch(selected, seedEditable)

function selectDate(cell: { date: string; isGathering: boolean }) {
  if (cell.isGathering) selected.value = cell.date
}

// ---- 兒童服事（P-04 報名／P-05 查看）----
/** 孩子已獲授權的服事項目（v5 #3：家長端只顯示已開通項目） */
function permittedItems(childId: string): string[] {
  return childPerms.value.filter((p) => p.child_id === childId).map((p) => p.item)
}
/** 具服事資格（至少一項授權）的孩子 */
const eligibleChildren = computed(() =>
  children.value.filter((c) => permittedItems(c.id).length > 0),
)

/** 「日期|孩子|項目」→ 報名紀錄（即點即存的切換依據） */
const childSignupAt = computed(() => {
  const map = new Map<string, ChildServiceSignup>()
  for (const cs of childSignups.value)
    map.set(`${cs.gathering_date}|${cs.child_id}|${cs.item}`, cs)
  return map
})

const savingService = ref(false)
async function toggleChildService(child: Child, item: string) {
  if (savingService.value) return
  savingService.value = true
  const existing = childSignupAt.value.get(`${selected.value}|${child.id}|${item}`)
  try {
    if (existing) {
      await removeChildSignup(existing.id)
      childSignups.value = childSignups.value.filter((x) => x.id !== existing.id)
    } else {
      await addChildSignup({
        child_id: child.id,
        gathering_date: selected.value,
        item,
        note: null,
      })
      const { from, to } = monthRange(anchor.value)
      childSignups.value = await listChildSignups(from, to)
    }
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingService.value = false
  }
}

/** 選定日期的已發布兒童服事表（僅顯示自己孩子所屬班別） */
const selectedRosters = computed(() => {
  const myClassIds = new Set(children.value.map((c) => String(c.class_group_id)))
  return childRosters.value.filter(
    (r) =>
      r.gathering_date === selected.value &&
      r.published &&
      myClassIds.has(String(r.class_group_id)),
  )
})
function rosterClassName(r: ChildServiceRoster): string {
  return (
    children.value.find((c) => String(c.class_group_id) === String(r.class_group_id))
      ?.class_groups?.name ?? ''
  )
}
function rosterLines(r: ChildServiceRoster): string[] {
  return (r.child_service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => `${a.item}：${a.child_name}`)
}

async function submit() {
  saving.value = true
  try {
    await upsertPlans(
      selected.value,
      children.value.map((c) => ({
        child_id: c.id,
        status: statusMap.value[c.id],
        note: noteMap.value[c.id]?.trim() || null,
      })),
    )
    await loadMonth() // 月曆點點同步更新
    showSuccessToast('已送出，感謝配合！')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h2>出席行事曆</h2>
    <p class="hint">
      {{ open
        ? `本週 ${formatGathering(gathering)}，${deadline.toLocaleDateString('zh-TW')}（${weekdayName(deadline)}）23:59 前可修改`
        : '本週已截止，如有變動請聯繫窗口' }}；未來聚會日也可提前填寫
    </p>

    <div class="card cal">
      <div class="cal-head">
        <button class="cal-nav" aria-label="上個月" @click="anchor = addMonths(anchor, -1)">‹</button>
        <strong>{{ monthTitle(anchor) }}</strong>
        <button class="cal-nav" aria-label="下個月" @click="anchor = addMonths(anchor, 1)">›</button>
      </div>
      <div class="cal-grid cal-week">
        <span v-for="w in WEEKDAY_NAMES" :key="w">{{ w }}</span>
      </div>
      <div class="cal-grid">
        <div
          v-for="cell in cells"
          :key="cell.date"
          class="cal-cell"
          :class="{
            out: !cell.inMonth,
            gday: cell.isGathering,
            sel: cell.date === selected,
            thisweek: cell.date === gathering,
          }"
          @click="selectDate(cell)"
        >
          <span class="num">{{ cell.day }}</span>
          <span v-if="cell.isGathering" class="dots">
            <i v-for="c in children" :key="c.id" :class="dotClass(cell.date, c.id)" />
          </span>
        </div>
      </div>
      <p class="cal-legend hint">
        ●<span class="lg-attend">出席</span> ●<span class="lg-leave">請假</span>
        ●<span class="lg-none">未定/未填</span> · 點聚會日查看
      </p>
    </div>

    <van-skeleton v-if="loading" title :row="4" />

    <!-- 本週與未來：可填寫（v5 #0） -->
    <template v-else-if="mode === 'edit'">
      <h3 class="section-title">
        {{ formatGathering(selected) }} · {{ selected === gathering ? '本週勾選' : '預先勾選' }}
      </h3>
      <p class="hint week-due">
        {{ openSel
          ? `${deadlineSel.toLocaleDateString('zh-TW')}（${weekdayName(deadlineSel)}）23:59 前可修改`
          : '此週已截止，如有變動請聯繫窗口' }}
      </p>
      <div v-for="c in children" :key="c.id" class="card">
        <div class="kid">
          <strong>{{ c.name }}</strong>
          <van-tag :style="classTagStyle(c.class_groups?.name)">{{ c.class_groups?.name ?? '' }}</van-tag>
        </div>
        <div class="seg">
          <van-button
            v-for="o in options"
            :key="o.value"
            size="small"
            :type="statusMap[c.id] === o.value ? 'primary' : 'default'"
            :disabled="!openSel"
            @click="statusMap[c.id] = o.value"
          >
            {{ o.label }}
          </van-button>
        </div>
        <van-field
          v-model="noteMap[c.id]"
          class="note"
          type="textarea"
          rows="1"
          autosize
          maxlength="200"
          placeholder="給老師的話（選填），例如：這週會帶奉獻、感冒剛好請提醒戴好口罩"
          :disabled="!openSel"
        />
      </div>

      <div v-if="children.length === 0" class="card hint">
        尚未綁定孩子，請聯繫兒童部窗口協助綁定。
      </div>

      <div class="card hint">勾選結果供同工預備課程與材料，臨時變動請記得取消</div>

      <van-button
        v-if="children.length > 0"
        round
        block
        type="primary"
        class="submit-btn"
        :loading="saving"
        :disabled="!openSel"
        @click="submit"
      >
        送出{{ selected === gathering ? '本週' : '該週' }}出席（{{ attendingCount }} 位出席）
      </van-button>
    </template>

    <!-- 過去的聚會日：唯讀 -->
    <template v-else-if="mode === 'past'">
      <h3 class="section-title">{{ formatGathering(selected) }} · 當週勾選紀錄</h3>
      <div v-if="children.length === 0" class="card hint">
        尚未綁定孩子，請聯繫兒童部窗口協助綁定。
      </div>
      <div v-for="c in children" :key="c.id" class="card">
        <div class="kid">
          <strong>{{ c.name }}</strong>
          <van-tag :style="classTagStyle(c.class_groups?.name)">{{ c.class_groups?.name ?? '' }}</van-tag>
          <van-tag
            class="status-tag"
            :type="planAt.get(`${selected}|${c.id}`)?.status === 'attending'
              ? 'success'
              : planAt.get(`${selected}|${c.id}`)?.status === 'leave' ? 'warning' : 'default'"
          >
            {{ planAt.get(`${selected}|${c.id}`)
              ? planLabel[planAt.get(`${selected}|${c.id}`)!.status]
              : '未填' }}
          </van-tag>
        </div>
        <p v-if="planAt.get(`${selected}|${c.id}`)?.note" class="hint past-note">
          💬 {{ planAt.get(`${selected}|${c.id}`)?.note }}
        </p>
      </div>
      <div class="card hint">此為當週預先勾選的紀錄；實際到課以老師現場點名為準。</div>
    </template>

    <!-- 兒童服事報名（P-04）：本週與未來聚會日皆可報名；僅具資格的孩子 -->
    <template v-if="!loading && mode !== 'past' && eligibleChildren.length > 0">
      <h3 class="section-title">兒童服事報名 · {{ formatGathering(selected) }}</h3>
      <div v-for="c in eligibleChildren" :key="c.id" class="card">
        <div class="kid">
          <strong>{{ c.name }}</strong>
          <van-tag :style="classTagStyle(c.class_groups?.name)">{{ c.class_groups?.name ?? '' }}</van-tag>
        </div>
        <div class="svc-tags">
          <van-tag
            v-for="it in permittedItems(c.id)"
            :key="it"
            round
            size="large"
            :type="childSignupAt.has(`${selected}|${c.id}|${it}`) ? 'primary' : 'default'"
            :plain="!childSignupAt.has(`${selected}|${c.id}|${it}`)"
            @click="toggleChildService(c, it)"
          >
            {{ childSignupAt.has(`${selected}|${c.id}|${it}`) ? '✓ ' : '' }}{{ it }}
          </van-tag>
        </div>
      </div>
      <p class="hint svc-note">
        點選即報名、再點取消；最終安排以同工發布的服事表為準。
      </p>
    </template>

    <!-- 兒童服事表（P-05）：發布後顯示自己孩子班別的安排 -->
    <template v-if="!loading && selectedRosters.length > 0">
      <h3 class="section-title">兒童服事表 · {{ formatGathering(selected) }}</h3>
      <div v-for="r in selectedRosters" :key="r.id" class="card">
        <div class="kid">
          <strong>{{ rosterClassName(r) }}</strong>
          <van-tag type="success" plain>已發布</van-tag>
        </div>
        <p v-for="line in rosterLines(r)" :key="line" class="svc-line">🙌 {{ line }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 出席頁字級整體放大 1.4 倍（使用者回饋） */
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.hint {
  font-size: 17px;
}

/* ---- 月曆 ---- */
.cal {
  padding: 14px 12px 10px;
  margin-top: 12px;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal-head strong {
  font-size: 20px;
}
.cal-nav {
  border: none;
  background: var(--kll-bg);
  color: var(--kll-primary-dark);
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 24px;
  line-height: 1;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-week span {
  text-align: center;
  font-size: 15px;
  color: var(--kll-sub);
  padding-bottom: 6px;
}
.cal-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  height: 52px;
  padding-top: 6px;
  border-radius: 10px;
  box-sizing: border-box;
}
.cal-cell .num {
  font-size: 18px;
  line-height: 1.2;
}
.cal-cell.out .num {
  color: #c3c9c6;
}
.cal-cell.gday {
  background: var(--kll-primary-soft);
  cursor: pointer;
}
.cal-cell.gday.out {
  background: var(--kll-bg);
}
.cal-cell.thisweek {
  outline: 2px solid var(--kll-primary);
  outline-offset: -2px;
}
.cal-cell.sel {
  background: var(--kll-primary);
}
.cal-cell.sel .num {
  color: #fff;
  font-weight: 700;
}
.dots {
  display: flex;
  gap: 3px;
}
.dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.dot-attend {
  background: #2aa876;
}
.sel .dot-attend {
  background: #bdeedd;
}
.dot-leave {
  background: var(--kll-amber);
}
.dot-none {
  background: #c3c9c6;
}
.sel .dot-none {
  background: #ffffff88;
}
.cal-legend {
  margin: 10px 2px 2px;
  font-size: 14px;
}
.lg-attend {
  color: #2aa876;
  margin: 0 8px 0 2px;
}
.lg-leave {
  color: var(--kll-amber);
  margin: 0 8px 0 2px;
}
.lg-none {
  color: var(--kll-sub);
  margin: 0 0 0 2px;
}
.cal-legend {
  letter-spacing: 0.2px;
}

/* ---- 孩子卡 ---- */
.kid {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.kid strong {
  font-size: 22px;
}
.kid :deep(.van-tag) {
  font-size: 15px;
  padding: 3px 10px;
}
.status-tag {
  margin-left: auto;
}
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.seg :deep(.van-button--small) {
  height: 46px;
  font-size: 20px;
}
.note {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--kll-bg);
  border-radius: 10px;
}
.note :deep(.van-field__control) {
  font-size: 18px;
}
.past-note {
  margin: 0;
}
.card.hint {
  font-size: 17px;
}
.week-due {
  margin: -4px 0 10px;
}
.submit-btn {
  height: 54px;
  font-size: 22px;
}
.svc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.svc-note {
  margin-top: 4px;
}
.svc-line {
  margin: 8px 0 0;
  font-size: 18px;
}
</style>
