<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import {
  listAllChildren,
  listCheckInsRange,
  listFeedbackRange,
  listPlansRange,
  listSessionLogsRange,
} from '../api/records'
import { downloadCsv } from '../lib/csv'
import { recordsRangeStart, upcomingGathering } from '../lib/gathering'
import type { AttendancePlan, CheckIn, Child, SessionFeedback, SessionLog } from '../types'

const from = recordsRangeStart() // 近半年
const to = upcomingGathering()

const children = ref<Child[]>([])
const plans = ref<AttendancePlan[]>([])
const checks = ref<CheckIn[]>([])
const feedback = ref<SessionFeedback[]>([])
const logs = ref<SessionLog[]>([])
const loading = ref(true)
const openDates = ref<string[]>([])

const childMap = computed(() => new Map(children.value.map((c) => [c.id, c])))

interface DateGroup {
  date: string
  planned: number
  present: number
  leave: number
  walkIn: number
  rows: {
    child: Child
    plan?: AttendancePlan
    check?: CheckIn
    moods: string[]
  }[]
}

const groups = computed<DateGroup[]>(() => {
  const byDate = new Map<string, DateGroup>()
  const ensure = (date: string) => {
    if (!byDate.has(date))
      byDate.set(date, { date, planned: 0, present: 0, leave: 0, walkIn: 0, rows: [] })
    return byDate.get(date)!
  }
  const rowFor = (date: string, childId: string) => {
    const g = ensure(date)
    let row = g.rows.find((r) => r.child.id === childId)
    if (!row) {
      const child = childMap.value.get(childId)
      if (!child) return null
      row = { child, moods: [] }
      g.rows.push(row)
    }
    return row
  }
  for (const p of plans.value) {
    const row = rowFor(p.gathering_date, p.child_id)
    if (row) row.plan = p
  }
  for (const c of checks.value) {
    const row = rowFor(c.gathering_date, c.child_id)
    if (row) row.check = c
  }
  for (const f of feedback.value) {
    const row = rowFor(f.gathering_date, f.child_id)
    if (row) row.moods = f.moods
  }
  for (const g of byDate.values()) {
    g.planned = g.rows.filter((r) => r.plan?.status === 'attending').length
    g.present = g.rows.filter((r) => r.check?.status === 'present').length
    g.leave = g.rows.filter((r) => r.check?.status === 'leave').length
    g.walkIn = g.rows.filter((r) => r.check?.status === 'present' && r.check.is_walk_in).length
    g.rows.sort((a, b) => a.child.name.localeCompare(b.child.name, 'zh-TW'))
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
})

onMounted(async () => {
  try {
    ;[children.value, plans.value, checks.value, feedback.value, logs.value] = await Promise.all([
      listAllChildren(),
      listPlansRange(from, to),
      listCheckInsRange(from, to),
      listFeedbackRange(from, to),
      listSessionLogsRange(from, to),
    ])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

const planLabel = { attending: '出席', leave: '請假', undecided: '未定' } as const
const checkLabel = { present: '簽到', leave: '臨時請假' } as const

/** 匯出「出席與學生狀況」：出席統計＋簽到＋表情＋備註整合於同一份表 */
function exportAttendance() {
  const rows: string[][] = [
    ['日期', '班別', '孩子', '預先出席', '家長備註', '當日狀態', '現場加入', '課堂表情', '老師備註'],
  ]
  for (const g of [...groups.value].reverse()) {
    for (const r of g.rows) {
      rows.push([
        g.date,
        r.child.class_groups?.name ?? '',
        r.child.name,
        r.plan ? planLabel[r.plan.status] : '未填',
        r.plan?.note ?? '',
        r.check ? checkLabel[r.check.status] : '未紀錄',
        r.check?.is_walk_in ? '是' : '',
        r.moods.join('、'),
        r.check?.note ?? '',
      ])
    }
  }
  downloadCsv(`出席與學生狀況_${from}_${to}.csv`, rows)
  showSuccessToast('已匯出，可存至教會 NAS 或匯入 Google Sheet')
}

/** 匯出「課堂紀錄」：日期、老師、教學內容、詩歌進度、課後反饋 */
function exportLogs() {
  const rows: string[][] = [['日期', '班別', '老師', '教學內容', '詩歌進度', '課後反饋']]
  const groupName = (id: string) =>
    children.value.find((c) => c.class_group_id === id)?.class_groups?.name ?? ''
  for (const l of [...logs.value].reverse()) {
    rows.push([l.gathering_date, groupName(l.class_group_id), l.teacher_name, l.content, l.song_progress, l.feedback])
  }
  downloadCsv(`課堂紀錄_${from}_${to}.csv`, rows)
  showSuccessToast('已匯出，可存至教會 NAS 或匯入 Google Sheet')
}
</script>

<template>
  <div class="page">
    <h2>出席紀錄（近半年）</h2>
    <p class="hint">{{ from }} ～ {{ to }}</p>

    <div class="export-row">
      <van-button size="small" type="primary" plain @click="exportAttendance">
        匯出出席與學生狀況
      </van-button>
      <van-button size="small" type="primary" plain @click="exportLogs">匯出課堂紀錄</van-button>
    </div>

    <van-skeleton v-if="loading" title :row="6" />
    <template v-else>
      <div v-if="groups.length === 0" class="card hint">此區間尚無紀錄</div>
      <van-collapse v-model="openDates">
        <van-collapse-item v-for="g in groups" :key="g.date" :name="g.date">
          <template #title>
            <div class="date-row">
              <strong>{{ g.date }}</strong>
              <span class="hint">
                預計 {{ g.planned }}｜簽到 {{ g.present }}｜請假 {{ g.leave }}
                <template v-if="g.walkIn">｜現場加入 {{ g.walkIn }}</template>
              </span>
            </div>
          </template>
          <div v-for="r in g.rows" :key="r.child.id" class="rec-row">
            <div class="rec-head">
              <strong>{{ r.child.name }}</strong>
              <span class="hint">{{ r.child.class_groups?.name }}</span>
              <van-tag v-if="r.plan" plain size="medium" :type="r.plan.status === 'attending' ? 'primary' : 'default'">
                預·{{ planLabel[r.plan.status] }}
              </van-tag>
              <van-tag
                v-if="r.check"
                size="medium"
                :type="r.check.status === 'present' ? 'success' : 'warning'"
              >
                {{ checkLabel[r.check.status] }}{{ r.check.is_walk_in ? '（現場）' : '' }}
              </van-tag>
            </div>
            <p v-if="r.plan?.note" class="hint">💬 家長：{{ r.plan.note }}</p>
            <p v-if="r.moods.length" class="hint">{{ r.moods.join('、') }}</p>
            <p v-if="r.check?.note" class="hint">📝 {{ r.check.note }}</p>
          </div>
        </van-collapse-item>
      </van-collapse>
      <p class="hint note">
        匯出的 CSV 為 UTF-8（含 BOM），可直接以 Excel 開啟、存放教會
        NAS，或於 Google Sheet「檔案 → 匯入」載入；建議由管理者每季匯出備份一次。
      </p>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.export-row {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.date-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.rec-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--kll-bg);
}
.rec-row:last-child {
  border-bottom: none;
}
.rec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rec-row p {
  margin: 4px 0 0;
}
.note {
  margin-top: 14px;
}
</style>
