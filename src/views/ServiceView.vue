<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  listChildRosters,
  listChildSignups,
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
import { formatGathering, upcomingGatherings } from '../lib/gathering'
import { SERVICE_ITEM_PRESETS, SIGNUP_WEEKS_AHEAD } from '../lib/service'
import { useAuthStore } from '../stores/auth'
import type {
  Child,
  ChildServiceRoster,
  ChildServiceSignup,
  ClassGroup,
  ServiceWeek,
  TeacherServiceSignup,
} from '../types'

const auth = useAuthStore()
const dates = upcomingGatherings(SIGNUP_WEEKS_AHEAD)

const activeTab = ref<'roster' | 'signup' | 'all' | 'kids'>('roster')
const groups = ref<ClassGroup[]>([])
const weeks = ref<ServiceWeek[]>([])
const signups = ref<TeacherServiceSignup[]>([])
const allChildren = ref<Child[]>([])
const childSignups = ref<ChildServiceSignup[]>([])
const childRosters = ref<ChildServiceRoster[]>([])
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
/** 服事表分頁：該日期有內容的班別（同工看全部班別以便建立） */
function rosterClasses(date: string): ClassGroup[] {
  if (auth.can('admin')) return groups.value
  return groups.value.filter((g) => weekAt.value.get(`${date}|${g.id}`)?.published)
}
function rosterDates(): string[] {
  if (auth.can('admin')) return dates
  return dates.filter((d) => rosterClasses(d).length > 0)
}

async function load() {
  loading.value = true
  try {
    const from = dates[0]
    const to = dates[dates.length - 1]
    ;[groups.value, weeks.value, signups.value, allChildren.value, childSignups.value, childRosters.value] =
      await Promise.all([
        listClassGroups(),
        listServiceWeeks(from, to),
        listSignups(from, to),
        listAllChildren(),
        listChildSignups(from, to),
        listChildRosters(from, to),
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
const editDraft = ref({ songs_text: '', topic: '', flex_text: '', published: false })
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
    ? { songs_text: w.songs_text, topic: w.topic, flex_text: w.flex_text, published: w.published }
    : { songs_text: '', topic: '', flex_text: '', published: false }
  editAssignments.value = (w?.service_assignments ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ teacher_id: a.teacher_id, teacher_name: a.teacher_name, item: a.item }))
  manualName.value = ''
  manualItem.value = ''
  editOpen.value = true
}

/** 當日報名者（跨班也列出，支援跨班支援），點一下帶入排班 */
function candidateSignups(): TeacherServiceSignup[] {
  return signupsAt.value.get(editDate.value) ?? []
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
/** 兒童服事表分頁：老師只看有已發布內容的日期；同工全看 */
function kidDates(): string[] {
  if (auth.can('admin')) return dates
  return dates.filter((d) =>
    kidsClasses.value.some((g) => kidRosterAt(d, g.id)?.published),
  )
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
    <p class="hint">未來 {{ dates.length }} 次聚會；報名後由核心同工排班、發布</p>

    <van-tabs v-model:active="activeTab" type="card" class="tabs">
      <van-tab name="roster" title="服事表" />
      <van-tab v-if="myClasses.length > 0" name="signup" title="我要報名" />
      <van-tab name="all" title="全部報名" />
      <van-tab v-if="showKidsTab" name="kids" title="兒童服事" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="6" />

    <!-- 服事表（T-COM-03；同工可編輯/發布 C-01） -->
    <template v-else-if="activeTab === 'roster'">
      <div v-if="rosterDates().length === 0" class="card hint">尚無已發布的服事表</div>
      <template v-for="d in rosterDates()" :key="d">
        <h3 class="section-title">{{ formatGathering(d) }}</h3>
        <div v-for="g in rosterClasses(d)" :key="g.id" class="card">
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
              @click="openEditor(d, g.id)"
            >
              {{ weekAt.get(`${d}|${g.id}`) ? '編輯' : '安排' }}
            </van-button>
          </div>
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
            <p v-if="weekAt.get(`${d}|${g.id}`)!.topic" class="svc-line">
              📖 主題：{{ weekAt.get(`${d}|${g.id}`)!.topic }}
            </p>
            <p v-if="weekAt.get(`${d}|${g.id}`)!.flex_text" class="svc-line">
              🎨 彈性時間：{{ weekAt.get(`${d}|${g.id}`)!.flex_text }}
            </p>
          </template>
          <p v-else class="hint">尚未安排</p>
        </div>
      </template>
    </template>

    <!-- 我要報名（T-COM-01） -->
    <template v-else-if="activeTab === 'signup'">
      <div v-for="d in dates" :key="d" class="card">
        <div class="week-head">
          <strong>{{ formatGathering(d) }}</strong>
          <span v-if="mySignups(d).length" class="hint">已報 {{ mySignups(d).length }} 項</span>
          <van-button size="mini" plain type="primary" class="week-edit" @click="openSignup(d)">
            ＋報名
          </van-button>
        </div>
        <div v-if="mySignups(d).length" class="signup-tags">
          <van-tag
            v-for="s in mySignups(d)"
            :key="s.id"
            round
            size="large"
            type="primary"
            plain
            closeable
            @close="cancelSignup(s)"
          >
            {{ groupName.get(s.class_group_id) }}·{{ s.item }}
          </van-tag>
        </div>
      </div>
      <p class="hint foot-note">點報名標籤右上角 × 可取消；排班以同工發布的服事表為準。</p>
    </template>

    <!-- 全部報名（T-COM-02） -->
    <template v-else>
      <template v-for="d in dates" :key="d">
        <h3 class="section-title">
          {{ formatGathering(d) }}
          <span class="hint">（{{ (signupsAt.get(d) ?? []).length }} 筆報名）</span>
        </h3>
        <div v-if="(signupsAt.get(d) ?? []).length === 0" class="card hint">尚無人報名</div>
        <div v-else class="card">
          <p v-for="s in signupsAt.get(d)" :key="s.id" class="svc-line">
            {{ s.teacher_name }}｜{{ groupName.get(s.class_group_id) }}｜{{ s.item }}
            <span v-if="s.note" class="hint">（{{ s.note }}）</span>
          </p>
        </div>
      </template>
    </template>

    <!-- 兒童服事（C-02 排班發布；T-KID-01 查看） -->
    <template v-if="!loading && activeTab === 'kids'">
      <div v-if="kidDates().length === 0" class="card hint">尚無已發布的兒童服事表</div>
      <template v-for="d in kidDates()" :key="d">
        <h3 class="section-title">{{ formatGathering(d) }}</h3>
        <div v-for="g in kidsClasses" :key="g.id" class="card">
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
          <p v-if="kidSignupsFor(d, g.id).length" class="hint svc-line">
            報名：{{ kidSignupsFor(d, g.id)
              .map((cs) => `${childById.get(cs.child_id)?.name ?? ''}·${cs.item}`)
              .join('、') }}
          </p>
          <p v-else-if="!kidRosterAt(d, g.id)" class="hint">尚無報名</p>
        </div>
      </template>
    </template>

    <!-- 報名彈窗 -->
    <van-popup
      :show="signupOpen"
      round
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

    <!-- 同工排班彈窗 -->
    <van-popup
      :show="editOpen"
      round
      position="bottom"
      @update:show="(v: boolean) => (editOpen = v)"
    >
      <div class="editor">
        <h3>{{ formatGathering(editDate) }}・{{ groupName.get(editClassId) }}</h3>
        <van-field v-model="editDraft.songs_text" label="詩歌" type="textarea" rows="1" autosize
          maxlength="300" placeholder="本週詩歌（文字）" />
        <van-field v-model="editDraft.topic" label="主題課程" type="textarea" rows="1" autosize
          maxlength="300" placeholder="課程主題" />
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

        <p class="hint pop-label">從當日報名帶入</p>
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
          <span v-if="candidateSignups().length === 0" class="hint">當日尚無報名</span>
        </div>

        <p class="hint pop-label">手動加入</p>
        <van-field v-model="manualName" label="老師" placeholder="姓名" />
        <van-field v-model="manualItem" label="項目" placeholder="例：敬拜">
          <template #button>
            <van-button size="small" plain @click="addManual">加入</van-button>
          </template>
        </van-field>

        <van-cell title="發布（老師可見）" center>
          <template #value><van-switch v-model="editDraft.published" size="24" /></template>
        </van-cell>

        <van-button round block type="primary" :loading="editSaving" class="save-btn" @click="saveWeek">
          儲存
        </van-button>
      </div>
    </van-popup>

    <!-- 兒童排班彈窗（同工） -->
    <van-popup
      :show="kidEditOpen"
      round
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

        <van-cell title="發布（家長與老師可見）" center>
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
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.tabs {
  margin: 12px 0;
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
