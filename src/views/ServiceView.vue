<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  addChildPermission,
  listChildPermissions,
  listChildServiceItems,
  listChildRosters,
  listChildSignups,
  removeChildPermission,
  setChildAssignments,
  upsertChildRoster,
} from '../api/childService'
import { listAllChildren } from '../api/records'
import {
  addSignup,
  listServiceWeeks,
  listSignups,
  removeSignup,
  setAssignments,
  upsertServiceWeek,
} from '../api/service'
import { downloadCsv } from '../lib/csv'
import { formatGathering, recentGatherings, upcomingGatherings } from '../lib/gathering'
import {
  SERVICE_COLUMNS,
  SERVICE_ITEM_PRESETS,
  SIGNUP_WEEKS_AHEAD,
  childServiceItemOptions,
  serviceGrid,
} from '../lib/service'
import { listClassTopics, upsertClassTopic } from '../api/topics'
import { listPlansRange } from '../api/attendance'
import { attendingByClass, attendingSummary, topicAt, topicIndex } from '../lib/serviceTopic'
import { useAuthStore } from '../stores/auth'
import type {
  AttendancePlan,
  Child,
  ChildServiceItem,
  ChildServicePermission,
  ChildServiceRoster,
  ChildServiceSignup,
  ClassGroup,
  ClassTopic,
  ServiceWeek,
  TeacherServiceSignup,
} from '../types'

const auth = useAuthStore()
const dates = upcomingGatherings(SIGNUP_WEEKS_AHEAD)

const activeTab = ref<'teacher' | 'kids'>('teacher')

// ---- 匯出近一季紀錄（v9 追加：老師服事排班／兒童服事安排）----
/** 近 12 次聚會＝約一季；由舊到新，最後一筆是最近一次聚會 */
const pastQuarter = recentGatherings(12)
const exporting = ref(false)

/** 匯出用的班名查詢（頁面另有同名的 groupName Map，故另取名） */
function className(id: string): string {
  return groups.value.find((g) => g.id === id)?.name ?? ''
}

/** 老師服事：排班（同工安排）與報名（老師自填）各自成列，一次看完一季 */
async function exportTeacherService() {
  if (exporting.value) return
  exporting.value = true
  try {
    const from = pastQuarter[0]
    const to = pastQuarter[pastQuarter.length - 1]
    const [pastWeeks, pastSignups] = await Promise.all([listServiceWeeks(from, to), listSignups(from, to)])
    const rows: string[][] = [
      ['日期', '班別', '類型', '姓名', '項目', '主題', '詩歌', '彈性時間', '已發布'],
    ]
    for (const w of [...pastWeeks].sort((a, b) => a.gathering_date.localeCompare(b.gathering_date))) {
      const assignments = w.service_assignments ?? []
      if (assignments.length === 0) {
        rows.push([w.gathering_date, className(w.class_group_id), '排班', '', '', w.topic, w.songs_text, w.flex_text, w.published ? '是' : '否'])
      }
      for (const a of [...assignments].sort((x, y) => x.sort_order - y.sort_order)) {
        rows.push([w.gathering_date, className(w.class_group_id), '排班', a.teacher_name, a.item, w.topic, w.songs_text, w.flex_text, w.published ? '是' : '否'])
      }
    }
    for (const sg of [...pastSignups].sort((a, b) => a.gathering_date.localeCompare(b.gathering_date))) {
      rows.push([sg.gathering_date, className(sg.class_group_id), '報名', sg.teacher_name, sg.item, '', '', '', ''])
    }
    downloadCsv(`老師服事_${from}_${to}.csv`, rows)
    showSuccessToast('已匯出近一季，可存 NAS 或匯入 Google Sheet')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    exporting.value = false
  }
}

/** 兒童服事：同工排定的安排（含未發布，供同工自己備查） */
async function exportChildService() {
  if (exporting.value) return
  exporting.value = true
  try {
    const from = pastQuarter[0]
    const to = pastQuarter[pastQuarter.length - 1]
    const pastRosters = await listChildRosters(from, to)
    const rows: string[][] = [['日期', '班別', '孩子', '項目', '已發布']]
    for (const r of [...pastRosters].sort((a, b) => a.gathering_date.localeCompare(b.gathering_date))) {
      const assignments = [...(r.child_service_assignments ?? [])].sort((x, y) => x.sort_order - y.sort_order)
      if (assignments.length === 0) {
        rows.push([r.gathering_date, className(r.class_group_id), '', '', r.published ? '是' : '否'])
      }
      for (const a of assignments) {
        rows.push([r.gathering_date, className(r.class_group_id), a.child_name, a.item, r.published ? '是' : '否'])
      }
    }
    downloadCsv(`兒童服事_${from}_${to}.csv`, rows)
    showSuccessToast('已匯出近一季，可存 NAS 或匯入 Google Sheet')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    exporting.value = false
  }
}
/** 摺疊卡展開狀態：預設展開本週 */
const openDates = ref<string[]>([dates[0]])
const kidOpenDates = ref<string[]>([dates[0]])
const groups = ref<ClassGroup[]>([])
const weeks = ref<ServiceWeek[]>([])
const signups = ref<TeacherServiceSignup[]>([])
const allChildren = ref<Child[]>([])
/** 預排主題（v16 #1）與家長預先出席（v16 #2）——都跟服事排班脫鉤，各自獨立載入 */
const topics = ref<ClassTopic[]>([])
const plans = ref<AttendancePlan[]>([])
const childSignups = ref<ChildServiceSignup[]>([])
const childRosters = ref<ChildServiceRoster[]>([])
const childPerms = ref<ChildServicePermission[]>([])
const loading = ref(true)

const me = computed(() => auth.session?.user.id ?? '')
const groupName = computed(() => new Map(groups.value.map((g) => [g.id, g.name])))
/** 我可報名的班別（老師＝被指派班別；同工可代填任何班） */
const myClasses = computed(() =>
  auth.can('admin') ? groups.value : groups.value.filter((g) => auth.canClass(g.id)),
)

const weekAt = computed(() => {
  const map = new Map<string, ServiceWeek>()
  for (const w of weeks.value) map.set(`${w.gathering_date}|${w.class_group_id}`, w)
  return map
})
const signupsAt = computed(() => {
  const map = new Map<string, TeacherServiceSignup[]>()
  for (const s of signups.value) {
    const list = map.get(s.gathering_date) ?? []
    list.push(s)
    map.set(s.gathering_date, list)
  }
  return map
})
function mySignups(date: string): TeacherServiceSignup[] {
  return (signupsAt.value.get(date) ?? []).filter((s) => s.teacher_id === me.value)
}
/** 班別劃分（v5 #1）：老師僅見自己被指派班別的內容；同工全視野 */
const visibleClassIds = computed(() => new Set(myClasses.value.map((g) => g.id)))
/** 服事表：該日期顯示的班別（同工看全部班別以便建立；老師只看自己班別的已發布） */
function rosterClasses(date: string): ClassGroup[] {
  if (auth.can('admin')) return groups.value
  return myClasses.value.filter((g) => weekAt.value.get(`${date}|${g.id}`)?.published)
}
/** 摺疊卡標題徽章：該日已發布的班數（依可見班別計算） */
function publishedClassCount(date: string): number {
  return myClasses.value.filter((g) => weekAt.value.get(`${date}|${g.id}`)?.published).length
}
/** 報名總覽（T-COM-02）：老師僅見自己班別的報名 */
function signupsShown(date: string): TeacherServiceSignup[] {
  return (signupsAt.value.get(date) ?? []).filter((s) =>
    visibleClassIds.value.has(String(s.class_group_id)),
  )
}

/**
 * 報名總覽表（v11 #10）：四類為欄、聚會日為列。
 * 同工排班時要一眼看出「上週誰排過、這週該換誰」，逐列文字看不出來。
 */
const overviewRows = computed(() =>
  serviceGrid(
    dates,
    dates.flatMap((d) =>
      signupsShown(d).map((sg) => ({
        gathering_date: d,
        teacher_name: sg.teacher_name,
        item: sg.item,
      })),
    ),
  ),
)

async function load() {
  loading.value = true
  try {
    const from = dates[0]
    const to = dates[dates.length - 1]
    ;[
      groups.value,
      weeks.value,
      signups.value,
      allChildren.value,
      childSignups.value,
      childRosters.value,
      childPerms.value,
      serviceItems.value,
      topics.value,
      plans.value,
    ] = await Promise.all([
      listClassGroups(),
      listServiceWeeks(from, to),
      listSignups(from, to),
      listAllChildren(),
      listChildSignups(from, to),
      listChildRosters(from, to),
      listChildPermissions(),
      listChildServiceItems(),
      listClassTopics(from, to),
      listPlansRange(from, to),
    ])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---- 我要報名（T-COM-01）----
const signupOpen = ref(false)
const signupDate = ref('')
const signupClassId = ref('')
/** 服事項目可複選，一次報多項 */
const signupItems = ref<string[]>([])
const signupCustom = ref('')
const signupNote = ref('')
const signupSaving = ref(false)

function openSignup(date: string) {
  signupDate.value = date
  signupClassId.value = myClasses.value[0]?.id ?? ''
  signupItems.value = []
  signupCustom.value = ''
  signupNote.value = ''
  signupOpen.value = true
}

function toggleSignupItem(item: string) {
  signupItems.value = signupItems.value.includes(item)
    ? signupItems.value.filter((x) => x !== item)
    : [...signupItems.value, item]
}

async function saveSignup() {
  const items = [...signupItems.value]
  const custom = signupCustom.value.trim()
  if (custom && !items.includes(custom)) items.push(custom)
  if (!signupClassId.value || items.length === 0) {
    showFailToast('請選擇班別與至少一個服事項目')
    return
  }
  signupSaving.value = true
  let ok = 0
  let dup = 0
  try {
    for (const item of items) {
      try {
        await addSignup({
          teacher_name: auth.profile?.display_name ?? '',
          gathering_date: signupDate.value,
          class_group_id: signupClassId.value,
          item,
          note: signupNote.value.trim() || null,
        })
        ok++
      } catch (e) {
        // 同日期同項目重複報名 → 跳過並統計，其他錯誤直接拋出
        if (/duplicate/i.test((e as Error).message)) dup++
        else throw e
      }
    }
    await load()
    showSuccessToast(
      dup > 0 ? `已報名 ${ok} 項（${dup} 項先前已報過，略過）` : `已報名 ${ok} 項`,
    )
    signupOpen.value = false
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    signupSaving.value = false
  }
}

async function cancelSignup(s: TeacherServiceSignup) {
  try {
    await showConfirmDialog({
      title: '取消報名',
      message: `取消 ${formatGathering(s.gathering_date)}「${s.item}」的報名？`,
    })
  } catch {
    return
  }
  try {
    await removeSignup(s.id)
    await load()
    showSuccessToast('已取消')
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

// ---- 同工排班（C-01）----
interface DraftAssignment {
  teacher_id: string | null
  teacher_name: string
  item: string
}
const editOpen = ref(false)
const editDate = ref('')
const editClassId = ref('')
/** 預排主題索引與查詢（v16 #1） */
const topicMap = computed(() => topicIndex(topics.value))
function topicOf(date: string, classGroupId: string): string {
  return topicAt(topicMap.value, date, classGroupId)
}

/** 那天各班家長已勾出席的人數（v16 #2）；沒人填就回空字串，整行不顯示 */
function plannedText(date: string): string {
  return attendingSummary(attendingByClass(plans.value, allChildren.value, groups.value, date))
}

// ---- 主題編輯（僅同工；與服事排班分開，不必先安排、也不必發布）----
const topicOpen = ref(false)
const topicDate = ref('')
const topicClassId = ref('')
const topicDraft = ref('')
const topicSaving = ref(false)

function openTopicEditor(date: string, classGroupId: string) {
  topicDate.value = date
  topicClassId.value = classGroupId
  topicDraft.value = topicOf(date, classGroupId)
  topicOpen.value = true
}

async function saveTopic() {
  if (topicSaving.value) return
  topicSaving.value = true
  try {
    await upsertClassTopic({
      gathering_date: topicDate.value,
      class_group_id: topicClassId.value,
      topic: topicDraft.value,
      updated_by_name: auth.profile?.display_name ?? '',
    })
    topics.value = await listClassTopics(dates[0], dates[dates.length - 1])
    topicOpen.value = false
    showSuccessToast('已儲存主題')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    topicSaving.value = false
  }
}

const editDraft = ref({ songs_text: '', flex_text: '', published: false })
const editAssignments = ref<DraftAssignment[]>([])
const manualName = ref('')
const manualItem = ref('')
const editSaving = ref(false)

function openEditor(date: string, classId: string) {
  if (!auth.can('admin')) return
  const w = weekAt.value.get(`${date}|${classId}`)
  editDate.value = date
  editClassId.value = classId
  editDraft.value = w
    ? { songs_text: w.songs_text, flex_text: w.flex_text, published: w.published }
    : { songs_text: '', flex_text: '', published: false }
  editAssignments.value = (w?.service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ teacher_id: a.teacher_id, teacher_name: a.teacher_name, item: a.item }))
  manualName.value = ''
  manualItem.value = ''
  editOpen.value = true
}

/** 當日報名者（v5 #1：僅列「正在編輯班別」的報名，班別劃分清晰），點一下帶入排班 */
function candidateSignups(): TeacherServiceSignup[] {
  return (signupsAt.value.get(editDate.value) ?? []).filter(
    (s) => String(s.class_group_id) === String(editClassId.value),
  )
}

function addFromSignup(s: TeacherServiceSignup) {
  editAssignments.value = [
    ...editAssignments.value,
    { teacher_id: s.teacher_id, teacher_name: s.teacher_name, item: s.item },
  ]
}

function addManual() {
  const name = manualName.value.trim()
  const item = manualItem.value.trim()
  if (!name || !item) {
    showFailToast('請填寫老師與項目')
    return
  }
  editAssignments.value = [...editAssignments.value, { teacher_id: null, teacher_name: name, item }]
  manualName.value = ''
  manualItem.value = ''
}

function removeAssignment(i: number) {
  editAssignments.value = editAssignments.value.filter((_, idx) => idx !== i)
}

async function saveWeek() {
  editSaving.value = true
  try {
    const weekId = await upsertServiceWeek({
      gathering_date: editDate.value,
      class_group_id: editClassId.value,
      ...editDraft.value,
      // 主題已改由 class_topics 管（v16 #1）；這裡原封帶回舊值，
      // 免得 upsert 把既有資料洗成空字串
      topic: weekAt.value.get(`${editDate.value}|${editClassId.value}`)?.topic ?? '',
    })
    await setAssignments(weekId, editAssignments.value)
    await load()
    showSuccessToast(editDraft.value.published ? '已儲存並發布' : '已儲存（未發布）')
    editOpen.value = false
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    editSaving.value = false
  }
}

// ---- 兒童服事（Wave 1b：C-02 排班發布；T-KID-01 查看）----
/** 兒童服事僅適用兒童班（權限矩陣：幼童/幼幼班老師「無」） */
const kidsClasses = computed(() => groups.value.filter((g) => g.name.includes('兒童')))
const showKidsTab = computed(
  () => auth.can('admin') || kidsClasses.value.some((g) => auth.canClass(g.id)),
)
const childById = computed(() => new Map(allChildren.value.map((c) => [c.id, c])))

function kidSignupsFor(date: string, classId: string): ChildServiceSignup[] {
  return childSignups.value.filter((cs) => {
    if (cs.gathering_date !== date) return false
    const child = childById.value.get(cs.child_id)
    return child != null && String(child.class_group_id) === classId
  })
}
function kidRosterAt(date: string, classId: string): ChildServiceRoster | undefined {
  return childRosters.value.find(
    (r) => r.gathering_date === date && String(r.class_group_id) === classId,
  )
}
function kidRosterLines(r: ChildServiceRoster): string[] {
  return (r.child_service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => `${a.item}：${a.child_name}`)
}
function kidPublishedCount(date: string): number {
  return kidsClasses.value.filter((g) => kidRosterAt(date, g.id)?.published).length
}
function kidSignupCount(date: string): number {
  return kidsClasses.value.reduce((n, g) => n + kidSignupsFor(date, g.id).length, 0)
}

// ---- 服事資格管理（v5 #3：孩子 × 項目逐項授權；該班老師或同工可開關）----
const showEligibility = ref(false)
/** 兒童班孩子（資格管理清單） */
const kidsChildren = computed(() =>
  allChildren.value
    .filter((c) => kidsClasses.value.some((g) => g.id === String(c.class_group_id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW')),
)
/** 孩子 → 已授權項目 */
const permsByChild = computed(() => {
  const map = new Map<string, ChildServicePermission[]>()
  for (const p of childPerms.value) {
    const list = map.get(p.child_id) ?? []
    list.push(p)
    map.set(p.child_id, list)
  }
  return map
})
function canEditPerm(c: Child): boolean {
  return auth.can('admin') || auth.canClass(String(c.class_group_id))
}

/** 兒童服事項目字典（v11 #4）：勾選按鈕的來源 */
const serviceItems = ref<ChildServiceItem[]>([])
const permChild = ref<Child | null>(null)
const permSaving = ref(false)

function openPermEditor(c: Child) {
  if (!canEditPerm(c)) return
  permChild.value = c
}
/** 此孩子在編輯器顯示的項目：字典啟用項目 ∪ 已授權的舊項目（v11 #4） */
function permItemOptions(c: Child): string[] {
  const granted = (permsByChild.value.get(c.id) ?? []).map((p) => p.item)
  return childServiceItemOptions(serviceItems.value, granted)
}
function hasPerm(c: Child, item: string): boolean {
  return (permsByChild.value.get(c.id) ?? []).some((p) => p.item === item)
}
/** 開通/移除單一項目（即點即存；children.service_eligible 由 DB 觸發器同步） */
async function togglePerm(c: Child, item: string) {
  if (permSaving.value) return
  permSaving.value = true
  const existing = (permsByChild.value.get(c.id) ?? []).find((p) => p.item === item)
  try {
    if (existing) {
      await removeChildPermission(existing.id)
      childPerms.value = childPerms.value.filter((p) => p.id !== existing.id)
    } else {
      await addChildPermission(c.id, item, auth.profile?.display_name ?? '')
      childPerms.value = await listChildPermissions()
    }
    // 本地同步派生欄位，讓「具資格孩子」清單即時反映
    const eligible = (permsByChild.value.get(c.id) ?? []).length > 0
    allChildren.value = allChildren.value.map((x) =>
      x.id === c.id ? { ...x, service_eligible: eligible } : x,
    )
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    permSaving.value = false
  }
}


interface KidDraftAssignment {
  child_id: string | null
  child_name: string
  item: string
}
const kidEditOpen = ref(false)
const kidEditDate = ref('')
const kidEditClassId = ref('')
const kidEditPublished = ref(false)
const kidAssignments = ref<KidDraftAssignment[]>([])
const kidManualItem = ref('')
const kidManualChildId = ref('')
const kidSaving = ref(false)

function openKidEditor(date: string, classId: string) {
  if (!auth.can('admin')) return
  const r = kidRosterAt(date, classId)
  kidEditDate.value = date
  kidEditClassId.value = classId
  kidEditPublished.value = r?.published ?? false
  kidAssignments.value = (r?.child_service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ child_id: a.child_id, child_name: a.child_name, item: a.item }))
  kidManualItem.value = ''
  kidManualChildId.value = ''
  kidEditOpen.value = true
}

/** 具服事資格、屬於此班的孩子（手動加入用） */
const kidEligible = computed(() =>
  allChildren.value.filter(
    (c) => c.service_eligible && String(c.class_group_id) === kidEditClassId.value,
  ),
)

function addKidFromSignup(cs: ChildServiceSignup) {
  const child = childById.value.get(cs.child_id)
  kidAssignments.value = [
    ...kidAssignments.value,
    { child_id: cs.child_id, child_name: child?.name ?? '', item: cs.item },
  ]
}

function addKidManual() {
  const child = childById.value.get(kidManualChildId.value)
  const item = kidManualItem.value.trim()
  if (!child || !item) {
    showFailToast('請選擇孩子並填寫項目')
    return
  }
  kidAssignments.value = [
    ...kidAssignments.value,
    { child_id: child.id, child_name: child.name, item },
  ]
  kidManualItem.value = ''
  kidManualChildId.value = ''
}

function removeKidAssignment(i: number) {
  kidAssignments.value = kidAssignments.value.filter((_, idx) => idx !== i)
}

async function saveKidRoster() {
  kidSaving.value = true
  try {
    const rosterId = await upsertChildRoster({
      gathering_date: kidEditDate.value,
      class_group_id: kidEditClassId.value,
      published: kidEditPublished.value,
    })
    await setChildAssignments(rosterId, kidAssignments.value)
    await load()
    showSuccessToast(kidEditPublished.value ? '已儲存並發布' : '已儲存（未發布）')
    kidEditOpen.value = false
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    kidSaving.value = false
  }
}

/** 排班顯示：項目：老師（依 sort_order） */
function assignmentLines(w: ServiceWeek): string[] {
  return (w.service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => `${a.item}：${a.teacher_name}`)
}
</script>

<template>
  <div class="page">
    <h2>服事排班</h2>
    <p class="hint">未來 {{ dates.length }} 次聚會；點日期展開查看與操作</p>

    <van-tabs v-model:active="activeTab" type="card" class="tabs">
      <van-tab name="teacher" title="老師服事" />
      <van-tab v-if="showKidsTab" name="kids" title="兒童服事" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="6" />

    <!-- ============ 老師服事：每個聚會日一張摺疊卡 ============ -->
    <template v-else-if="activeTab === 'teacher'">
      <van-button size="small" plain type="primary" class="export-btn" :loading="exporting"
        @click="exportTeacherService">
        匯出近一季（12 週）排班與報名
      </van-button>
      <!-- 報名總覽表（v6 #7a → v11 #10 改為表格）：直欄看同一類誰排過，橫列看某週的完整分工 -->
      <div class="card">
        <p class="blk-title ov-title">未來 {{ dates.length }} 週報名總覽</p>
        <p class="hint ov-tip">直欄看同一類誰排過、橫列看某週的完整分工；表格可左右滑動</p>
        <div class="ov-scroll">
          <table class="ov-table">
            <thead>
              <tr>
                <th class="ov-th-date">聚會日</th>
                <th v-for="c in SERVICE_COLUMNS" :key="c">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in overviewRows" :key="'ov' + row.date">
                <th class="ov-th-date">{{ row.date.slice(5).replace('-', '/') }}</th>
                <td v-for="c in SERVICE_COLUMNS" :key="c">
                  <span v-if="row.cells[c].length === 0" class="ov-empty">—</span>
                  <span v-for="n in row.cells[c]" :key="n" class="ov-name">{{ n }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-for="row in overviewRows.filter((r) => r.others.length > 0)" :key="'oth' + row.date"
          class="hint ov-others">
          {{ row.date.slice(5).replace('-', '/') }} 其他：{{ row.others.join('、') }}
        </p>
      </div>

    <van-collapse v-model="openDates">
      <van-collapse-item v-for="d in dates" :key="d" :name="d">
        <template #title>
          <div class="date-title">
            <strong>{{ formatGathering(d) }}</strong>
            <span class="date-badges">
              <van-tag v-if="publishedClassCount(d) > 0" type="success">
                已發布 {{ publishedClassCount(d) }} 班
              </van-tag>
              <van-tag v-if="mySignups(d).length" type="primary" plain>
                我報 {{ mySignups(d).length }}
              </van-tag>
              <van-tag v-if="signupsShown(d).length" plain>
                共 {{ signupsShown(d).length }} 筆報名
              </van-tag>
            </span>
          </div>
        </template>

        <!-- A. 服事表（T-COM-03／C-01） -->
        <p class="blk-title">服事表</p>
        <!-- 家長已勾的預先出席（v16 #2）：老師提早知道那天大概幾個孩子會來，好準備材料與分組。
             另起一行不與標題同列——手機 390px 寬放不下，擠在一起會把標題推掉並撐出橫向捲動。 -->
        <p v-if="plannedText(d)" class="hint planned">🙋 預計出席：{{ plannedText(d) }}</p>
        <div v-for="g in rosterClasses(d)" :key="g.id" class="svc-block">
          <div class="week-head">
            <strong>{{ g.name }}</strong>
            <van-tag
              v-if="weekAt.get(`${d}|${g.id}`)"
              :type="weekAt.get(`${d}|${g.id}`)!.published ? 'success' : 'default'"
              plain
            >
              {{ weekAt.get(`${d}|${g.id}`)!.published ? '已發布' : '草稿' }}
            </van-tag>
            <van-button
              v-if="auth.can('admin')"
              size="mini"
              plain
              class="week-edit"
              @click="openTopicEditor(d, g.id)"
            >
              主題
            </van-button>
            <van-button
              v-if="auth.can('admin')"
              size="mini"
              plain
              @click="openEditor(d, g.id)"
            >
              {{ weekAt.get(`${d}|${g.id}`) ? '編輯' : '安排' }}
            </van-button>
          </div>
          <!--
            預排主題（v16 #1）：放在服事安排之外，不論有沒有安排、有沒有發布都顯示——
            老師需要主題的時機正是「決定要不要報名這一週」，那時還沒發布。
          -->
          <p v-if="topicOf(d, g.id)" class="svc-line topic-line">
            📖 主題：{{ topicOf(d, g.id) }}
          </p>
          <template v-if="weekAt.get(`${d}|${g.id}`)">
            <p
              v-for="line in assignmentLines(weekAt.get(`${d}|${g.id}`)!)"
              :key="line"
              class="svc-line"
            >
              👤 {{ line }}
            </p>
            <p v-if="weekAt.get(`${d}|${g.id}`)!.songs_text" class="svc-line">
              🎵 詩歌：{{ weekAt.get(`${d}|${g.id}`)!.songs_text }}
            </p>
            <p v-if="weekAt.get(`${d}|${g.id}`)!.flex_text" class="svc-line">
              🎨 彈性時間：{{ weekAt.get(`${d}|${g.id}`)!.flex_text }}
            </p>
          </template>
          <p v-else class="hint svc-empty">尚未安排</p>
        </div>
        <p v-if="rosterClasses(d).length === 0" class="hint svc-empty">尚未發布</p>

        <!-- B. 我的報名（T-COM-01） -->
        <template v-if="myClasses.length > 0">
          <div class="blk-row">
            <p class="blk-title">我的報名</p>
            <van-button size="mini" plain type="primary" @click="openSignup(d)">＋報名</van-button>
          </div>
          <div v-if="mySignups(d).length" class="signup-tags">
            <van-tag
              v-for="sg in mySignups(d)"
              :key="sg.id"
              round
              size="large"
              type="primary"
              plain
              closeable
              @close="cancelSignup(sg)"
            >
              {{ groupName.get(sg.class_group_id) }}·{{ sg.item }}
            </van-tag>
          </div>
          <p v-else class="hint svc-empty">尚未報名（點「＋報名」可複選多個項目）</p>
        </template>

        <!-- C. 全部報名（T-COM-02） -->
        <p class="blk-title">{{ auth.can('admin') ? '全部報名' : '本班報名' }}</p>
        <template v-if="signupsShown(d).length">
          <p v-for="sg in signupsShown(d)" :key="sg.id" class="svc-line small">
            {{ sg.teacher_name }}｜{{ groupName.get(sg.class_group_id) }}｜{{ sg.item }}
            <span v-if="sg.note" class="hint">（{{ sg.note }}）</span>
          </p>
        </template>
        <p v-else class="hint svc-empty">尚無人報名</p>
      </van-collapse-item>
    </van-collapse>
    </template>

    <!-- ============ 兒童服事（只有兒童相關內容） ============ -->
    <template v-else>
      <van-button size="small" plain type="primary" class="export-btn" :loading="exporting"
        @click="exportChildService">
        匯出近一季（12 週）兒童服事安排
      </van-button>
      <!-- 服事資格管理（v5 #3：孩子×項目逐項授權；該班老師或同工可開關） -->
      <div class="card">
        <div class="blk-row">
          <strong class="elig-title">服事資格</strong>
          <van-button size="mini" plain @click="showEligibility = !showEligibility">
            {{ showEligibility ? '收合' : `管理（已開通 ${kidsChildren.filter((c) => c.service_eligible).length} 位）` }}
          </van-button>
        </div>
        <template v-if="showEligibility">
          <p class="hint">點孩子名字設定可服事的項目；家長在出席頁只會看到已開通的項目</p>
          <div class="tag-row">
            <van-tag
              v-for="c in kidsChildren"
              :key="c.id"
              round
              size="large"
              :type="(permsByChild.get(c.id)?.length ?? 0) > 0 ? 'primary' : 'default'"
              :plain="(permsByChild.get(c.id)?.length ?? 0) === 0"
              @click="openPermEditor(c)"
            >
              {{ c.name }}{{ (permsByChild.get(c.id)?.length ?? 0) > 0
                ? `・${permsByChild.get(c.id)!.length} 項` : '' }}
            </van-tag>
            <span v-if="kidsChildren.length === 0" class="hint">兒童班尚無孩子名單</span>
          </div>
        </template>
      </div>

      <van-collapse v-model="kidOpenDates">
        <van-collapse-item v-for="d in dates" :key="d" :name="d">
          <template #title>
            <div class="date-title">
              <strong>{{ formatGathering(d) }}</strong>
              <span class="date-badges">
                <van-tag v-if="kidPublishedCount(d) > 0" type="success">已發布</van-tag>
                <van-tag v-if="kidSignupCount(d)" plain>{{ kidSignupCount(d) }} 筆報名</van-tag>
              </span>
            </div>
          </template>

          <div v-for="g in kidsClasses" :key="g.id" class="svc-block">
            <div class="week-head">
              <strong>{{ g.name }}</strong>
              <van-tag
                v-if="kidRosterAt(d, g.id)"
                :type="kidRosterAt(d, g.id)!.published ? 'success' : 'default'"
                plain
              >
                {{ kidRosterAt(d, g.id)!.published ? '已發布' : '草稿' }}
              </van-tag>
              <van-button
                v-if="auth.can('admin')"
                size="mini"
                plain
                class="week-edit"
                @click="openKidEditor(d, g.id)"
              >
                {{ kidRosterAt(d, g.id) ? '編輯' : '安排' }}
              </van-button>
            </div>
            <template v-if="kidRosterAt(d, g.id)">
              <p v-for="line in kidRosterLines(kidRosterAt(d, g.id)!)" :key="line" class="svc-line">
                🙌 {{ line }}
              </p>
            </template>
            <p v-if="kidSignupsFor(d, g.id).length" class="svc-line small">
              報名：{{ kidSignupsFor(d, g.id)
                .map((cs) => `${childById.get(cs.child_id)?.name ?? ''}·${cs.item}`)
                .join('、') }}
            </p>
            <p v-else-if="!kidRosterAt(d, g.id)" class="hint svc-empty">尚無報名與安排</p>
          </div>
        </van-collapse-item>
      </van-collapse>
    </template>

    <!-- 報名彈窗 -->
    <van-popup
      :show="signupOpen"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (signupOpen = v)"
    >
      <div class="editor">
        <h3>{{ formatGathering(signupDate) }} 服事報名</h3>
        <p class="hint pop-label">班別</p>
        <div class="tag-row">
          <van-tag
            v-for="g in myClasses"
            :key="g.id"
            round
            size="large"
            :type="signupClassId === g.id ? 'primary' : 'default'"
            :plain="signupClassId !== g.id"
            @click="signupClassId = g.id"
          >
            {{ g.name }}
          </van-tag>
        </div>
        <p class="hint pop-label">
          服事項目（可複選<template v-if="signupItems.length"
            >，已選 {{ signupItems.length }} 項</template
          >）
        </p>
        <div class="tag-row">
          <van-tag
            v-for="it in SERVICE_ITEM_PRESETS"
            :key="it"
            round
            size="large"
            :type="signupItems.includes(it) ? 'primary' : 'default'"
            :plain="!signupItems.includes(it)"
            @click="toggleSignupItem(it)"
          >
            {{ signupItems.includes(it) ? '✓ ' : '' }}{{ it }}
          </van-tag>
        </div>
        <van-field
          v-model="signupCustom"
          label="其他項目"
          placeholder="未列出的服事項目（會與勾選的一併送出）"
        />
        <van-field v-model="signupNote" label="備註" maxlength="100" placeholder="選填" />
        <van-button round block type="primary" :loading="signupSaving" class="save-btn" @click="saveSignup">
          送出報名{{ signupItems.length + (signupCustom.trim() ? 1 : 0) > 0
            ? `（${signupItems.length + (signupCustom.trim() ? 1 : 0)} 項）` : '' }}
        </van-button>
      </div>
    </van-popup>

    <!-- 預排主題彈窗（v16 #1，僅同工） -->
    <van-popup
      :show="topicOpen"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (topicOpen = v)"
    >
      <div class="editor">
        <h3>{{ formatGathering(topicDate) }}・{{ groupName.get(topicClassId) }}</h3>
        <p class="hint pop-label">
          這週要帶的主題。老師在報名服事時就看得到，不必等服事表發布。
        </p>
        <van-field v-model="topicDraft" label="主題" type="textarea" rows="2" autosize
          maxlength="300" placeholder="例：品格週-分享／油瓶不斷 — 王下 4:1-7" />
        <p class="hint pop-label">清空內容並儲存＝取消這一週的主題。</p>
        <van-button round block type="primary" :loading="topicSaving" class="save-btn"
          @click="saveTopic">
          儲存主題
        </van-button>
      </div>
    </van-popup>

    <!-- 同工排班彈窗 -->
    <van-popup
      :show="editOpen"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (editOpen = v)"
    >
      <div class="editor">
        <h3>{{ formatGathering(editDate) }}・{{ groupName.get(editClassId) }}</h3>
        <van-field v-model="editDraft.songs_text" label="詩歌" type="textarea" rows="1" autosize
          maxlength="300" placeholder="本週詩歌（文字）" />
        <van-field v-model="editDraft.flex_text" label="彈性時間" type="textarea" rows="1" autosize
          maxlength="300" placeholder="彈性時間安排" />

        <p class="hint pop-label">已排班（點 × 移除）</p>
        <div class="tag-row">
          <van-tag
            v-for="(a, i) in editAssignments"
            :key="`${a.teacher_name}-${a.item}-${i}`"
            round
            size="large"
            type="primary"
            plain
            closeable
            @close="removeAssignment(i)"
          >
            {{ a.item }}：{{ a.teacher_name }}
          </van-tag>
          <span v-if="editAssignments.length === 0" class="hint">尚未排班</span>
        </div>

        <p class="hint pop-label">從當日報名帶入（僅列 {{ groupName.get(editClassId) }} 的報名）</p>
        <div class="tag-row">
          <van-tag
            v-for="s in candidateSignups()"
            :key="s.id"
            round
            size="large"
            plain
            @click="addFromSignup(s)"
          >
            ＋{{ s.teacher_name }}·{{ s.item }}
          </van-tag>
          <span v-if="candidateSignups().length === 0" class="hint">
            此班當日尚無報名（可於下方手動加入）
          </span>
        </div>

        <p class="hint pop-label">手動加入</p>
        <van-field v-model="manualName" label="老師" placeholder="姓名" />
        <van-field v-model="manualItem" label="項目" placeholder="例：敬拜">
          <template #button>
            <van-button size="small" plain @click="addManual">加入</van-button>
          </template>
        </van-field>

        <van-cell title="發布" label="發布後老師可見；未發布僅同工（管理員）可見" center>
          <template #value><van-switch v-model="editDraft.published" size="24" /></template>
        </van-cell>

        <van-button round block type="primary" :loading="editSaving" class="save-btn" @click="saveWeek">
          儲存
        </van-button>
      </div>
    </van-popup>

    <!-- 服事資格項目編輯（v5 #3） -->
    <van-popup
      :show="permChild !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (permChild = null)"
    >
      <div class="editor" v-if="permChild">
        <h3>{{ permChild.name }} 的服事項目</h3>
        <p class="hint pop-label">點選開通/取消（即點即存）；家長端只會看到已開通的項目</p>
        <div class="tag-row">
          <van-tag
            v-for="it in permItemOptions(permChild)"
            :key="it"
            round
            size="large"
            :type="hasPerm(permChild, it) ? 'primary' : 'default'"
            :plain="!hasPerm(permChild, it)"
            @click="togglePerm(permChild, it)"
          >
            {{ hasPerm(permChild, it) ? '✓ ' : '' }}{{ it }}
          </van-tag>
        </div>
        <!-- v6 #6a：項目固定六項，自訂新增暫時隱藏（既有自訂授權仍會顯示於上方可取消） -->
        <p class="hint pop-label">
          {{ (permsByChild.get(permChild.id)?.length ?? 0) > 0
            ? `已開通 ${permsByChild.get(permChild.id)!.length} 項`
            : '尚未開通任何項目（家長端不會出現服事報名）' }}
        </p>
      </div>
    </van-popup>

    <!-- 兒童排班彈窗（同工） -->
    <van-popup
      :show="kidEditOpen"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (kidEditOpen = v)"
    >
      <div class="editor">
        <h3>{{ formatGathering(kidEditDate) }}・{{ groupName.get(kidEditClassId) }}兒童服事</h3>

        <p class="hint pop-label">已排班（點 × 移除）</p>
        <div class="tag-row">
          <van-tag
            v-for="(a, i) in kidAssignments"
            :key="`${a.child_name}-${a.item}-${i}`"
            round
            size="large"
            type="primary"
            plain
            closeable
            @close="removeKidAssignment(i)"
          >
            {{ a.item }}：{{ a.child_name }}
          </van-tag>
          <span v-if="kidAssignments.length === 0" class="hint">尚未排班</span>
        </div>

        <p class="hint pop-label">從報名帶入</p>
        <div class="tag-row">
          <van-tag
            v-for="cs in kidSignupsFor(kidEditDate, kidEditClassId)"
            :key="cs.id"
            round
            size="large"
            plain
            @click="addKidFromSignup(cs)"
          >
            ＋{{ childById.get(cs.child_id)?.name ?? '' }}·{{ cs.item }}
          </van-tag>
          <span v-if="kidSignupsFor(kidEditDate, kidEditClassId).length === 0" class="hint">
            尚無報名
          </span>
        </div>

        <p class="hint pop-label">手動加入（僅具服事資格的孩子）</p>
        <div class="tag-row">
          <van-tag
            v-for="c in kidEligible"
            :key="c.id"
            round
            size="large"
            :type="kidManualChildId === c.id ? 'primary' : 'default'"
            :plain="kidManualChildId !== c.id"
            @click="kidManualChildId = kidManualChildId === c.id ? '' : c.id"
          >
            {{ c.name }}
          </van-tag>
          <span v-if="kidEligible.length === 0" class="hint">此班尚無具資格的孩子</span>
        </div>
        <van-field v-model="kidManualItem" label="項目" placeholder="例：收奉獻">
          <template #button>
            <van-button size="small" plain @click="addKidManual">加入</van-button>
          </template>
        </van-field>

        <van-cell title="發布" label="發布後家長與老師可見；未發布僅同工（管理員）可見" center>
          <template #value><van-switch v-model="kidEditPublished" size="24" /></template>
        </van-cell>

        <van-button round block type="primary" :loading="kidSaving" class="save-btn" @click="saveKidRoster">
          儲存
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
/* v16：主題與預計出席都是「服事安排之外」的資訊，視覺上與排班列區隔 */
.topic-line {
  color: var(--kll-primary-text);
  font-weight: 700;
}
.planned {
  /* 不能 nowrap：三個班別的文字在手機上一行放不下，會撐出橫向溢出把班別名切掉 */
  margin: 0 0 8px;
  line-height: 1.6;
}
.export-btn {
  margin-bottom: 10px;
}
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.tabs {
  margin: 12px 0;
}
.date-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.date-title strong {
  font-size: 19px;
}
.date-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ov-title {
  margin-top: 0;
}
/* 總覽表：手機放不下四欄＋日期，讓表自己橫向捲動，頁面本身不橫捲 */
.ov-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -4px;
}
.ov-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 460px;
  font-size: 15px;
}
.ov-table th,
.ov-table td {
  border: 1px solid var(--kll-line);
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
.ov-table thead th {
  background: var(--kll-primary-soft);
  color: var(--kll-primary-text);
  font-size: 14px;
  white-space: nowrap;
}
.ov-th-date {
  white-space: nowrap;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--kll-bg);
}
.ov-name {
  display: block;
  line-height: 1.5;
}
.ov-empty {
  color: var(--kll-muted);
}
.ov-others {
  margin: 8px 2px 0;
}
.ov-tip {
  margin: 0 0 8px;
}
.blk-title {
  margin: 14px 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--kll-primary-dark);
  letter-spacing: 0.05em;
}
.blk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.blk-row .ov-title {
  margin-top: 0;
}
.blk-title {
  margin: 14px 0 6px;
}
.elig-title {
  font-size: 20px;
}
.svc-block {
  padding: 10px 12px;
  background: var(--kll-bg);
  border-radius: 10px;
  margin-bottom: 8px;
}
.svc-empty {
  margin: 4px 0 8px;
}
.svc-line.small {
  font-size: 16px;
}
.week-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.week-head strong {
  flex: 1;
  font-size: 20px;
}
.week-edit {
  flex-shrink: 0;
}
.svc-line {
  margin: 8px 0 0;
  font-size: 18px;
}
.signup-tags,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.foot-note {
  margin-top: 12px;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 12px;
  text-align: center;
  font-size: 22px;
}
.pop-label {
  margin: 12px 16px 6px;
}
.editor .tag-row {
  margin: 0 16px;
}
.save-btn {
  margin-top: 14px;
}
</style>
