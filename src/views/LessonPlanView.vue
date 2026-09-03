<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast, type PickerOption } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createLessonSegment,
  deleteLessonSegment,
  listClassDocs,
  listLessonSegments,
  listLessonSegmentsRange,
  updateLessonSegment,
} from '../api/teaching'
import {
  formatGathering,
  recentGatherings,
  upcomingGathering,
  upcomingGatherings,
} from '../lib/gathering'
import {
  LESSON_DEFAULT_START,
  LESSON_TEMPLATE,
  templateFromFlows,
  addToClock,
  composeTimeText,
  parseTimeText,
  totalMinutes,
} from '../lib/lesson'
import { downloadCsv } from '../lib/csv'
import { classHasIndex } from '../lib/performance'
import { LESSON_ITEM_PRESETS } from '../lib/teaching'
import { useAuthStore } from '../stores/auth'
import type { ClassDoc, ClassGroup, LessonSegment } from '../types'
import { classColor } from '../lib/classColor'

const auth = useAuthStore()
/**
 * 可選聚會日：**近 3 次＋未來 12 次**（v9 #9 修正）。
 * 教案是往前規劃用的，未來開到 12 週；過去只留 3 次供補填「課後執行」，
 * 更早的紀錄走「匯出近一季」而不是把選單拉成半年那麼長。
 */
const dates = [...new Set([...recentGatherings(3), ...upcomingGatherings(12)])]
const selectedDate = ref(upcomingGathering())

const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
/** 班別頁籤依班別上色（v9 #1）：兒童＝太陽色、幼童＝天藍、幼幼＝嫩綠 */
const activeClassColor = computed(() =>
  classColor(groups.value.find((g) => g.id === activeGroup.value)?.name),
)
const segments = ref<LessonSegment[]>([])
/** 該班的聚會流程：教案範本的來源（v9 #4），沒有資料才退回內建 11 段 */
const flowDocs = ref<ClassDoc[]>([])
const loading = ref(true)

/** 可否編輯目前班別（該班老師或同工；分區塊共編以段落為單位） */
const canEdit = computed(() => auth.can('admin') || auth.canClass(activeGroup.value))

const total = computed(() => totalMinutes(segments.value.map((s) => s.time_text)))

/** 呈現用：拆回大字分鐘數與起訖區間 */
function timeOf(seg: LessonSegment): { min: string; range: string } {
  const t = parseTimeText(seg.time_text)
  return {
    min: t.minutes != null ? `${t.minutes}分` : '—',
    range: t.start ? `${t.start}${t.end ? `–${t.end}` : ''}` : '',
  }
}

async function load() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    const [segs, docs] = await Promise.all([
      listLessonSegments(activeGroup.value, selectedDate.value),
      listClassDocs(activeGroup.value),
    ])
    segments.value = segs
    flowDocs.value = docs.filter((d) => d.kind === 'flow')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    // 教案不含幼幼班（權限矩陣）
    groups.value = (await listClassGroups()).filter((g) => classHasIndex(g.name))
    activeGroup.value = groups.value[0]?.id ?? ''
    if (!activeGroup.value) loading.value = false
  } catch (e) {
    showFailToast((e as Error).message)
    loading.value = false
  }
})

watch([activeGroup, selectedDate], load)

/**
 * 一鍵建立本日教案的範本（v9 #4）：優先用該班「聚會流程與運作要點」的項目，
 * 這樣同工在流程頁增減段落，教案範本就會跟著變；該班沒有流程資料才退回內建 11 段。
 */
const templateItems = computed(() =>
  flowDocs.value.length > 0
    ? templateFromFlows(flowDocs.value)
    : (LESSON_TEMPLATE as { minutes: number | null; item: string }[]),
)
const templateSource = computed(() => (flowDocs.value.length > 0 ? '本班聚會流程' : '內建標準流程'))
/** 段落「項目」的建議標籤同樣同步聚會流程（v9 追加），沒有流程資料才用內建清單 */
const itemPresets = computed(() =>
  flowDocs.value.length > 0 ? flowDocs.value.map((d) => d.title) : LESSON_ITEM_PRESETS,
)

/** 匯出近一季（12 次聚會）的教案，供存 NAS 或匯入 Google Sheet（v9 追加） */
const pastQuarter = recentGatherings(12)
const exporting = ref(false)
async function exportQuarter() {
  if (exporting.value || !activeGroup.value) return
  exporting.value = true
  try {
    const from = pastQuarter[0]
    const to = pastQuarter[pastQuarter.length - 1]
    const list = await listLessonSegmentsRange(activeGroup.value, from, to)
    const name = groups.value.find((g) => g.id === activeGroup.value)?.name ?? ''
    const rows: string[][] = [
      ['日期', '班別', '順序', '時間', '項目', '內容', '老師', '教材預備', '課後執行'],
    ]
    for (const seg of list) {
      rows.push([
        seg.gathering_date,
        name,
        String(seg.sort_order + 1),
        seg.time_text,
        seg.item,
        seg.content,
        seg.teacher_text,
        seg.materials_text,
        seg.review_text,
      ])
    }
    downloadCsv(`教案_${name}_${from}_${to}.csv`, rows)
    showSuccessToast('已匯出近一季，可存 NAS 或匯入 Google Sheet')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    exporting.value = false
  }
}

const creatingTemplate = ref(false)
async function createFromTemplate() {
  if (creatingTemplate.value) return
  creatingTemplate.value = true
  try {
    // 流程項目沒填分鐘時無法推算後續起訖，該段起就只留分鐘數/留空（時間連動的既有行為一致）
    let start: string | null = LESSON_DEFAULT_START
    let order = 0
    for (const t of templateItems.value) {
      await createLessonSegment({
        class_group_id: activeGroup.value,
        gathering_date: selectedDate.value,
        time_text: start ? composeTimeText(t.minutes, start) : composeTimeText(t.minutes, ''),
        item: t.item,
        content: '',
        teacher_text: '',
        materials_text: '',
        review_text: '',
        sort_order: order++,
        updated_by_name: auth.profile?.display_name ?? '',
      })
      start = start && t.minutes != null ? addToClock(start, t.minutes) : null
    }
    await load()
    showSuccessToast('已建立標準流程，點各段落填寫內容')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    creatingTemplate.value = false
  }
}

// ---- 段落編輯（分區塊：一段一存）----
const editing = ref<LessonSegment | 'new' | null>(null)
const draft = ref({
  minutes: '' as string | number,
  start: '',
  item: '',
  content: '',
  teacher_text: '',
  materials_text: '',
  review_text: '',
})
const saving = ref(false)

/** 編輯中時間預覽：如「10分鐘 14:00-14:10」 */
const timePreview = computed(() =>
  composeTimeText(draft.value.minutes ? Number(draft.value.minutes) : null, draft.value.start),
)

function openEditor(seg: LessonSegment | null) {
  if (!canEdit.value) return
  editing.value = seg ?? 'new'
  if (seg) {
    const t = parseTimeText(seg.time_text)
    draft.value = {
      minutes: t.minutes != null ? String(t.minutes) : '',
      start: t.start,
      item: seg.item,
      content: seg.content,
      teacher_text: seg.teacher_text,
      materials_text: seg.materials_text,
      review_text: seg.review_text,
    }
  } else {
    // 新段落：自動接在最後一段的結束時間之後
    const last = segments.value[segments.value.length - 1]
    const lastEnd = last ? parseTimeText(last.time_text).end : ''
    draft.value = {
      minutes: '10',
      start: lastEnd || (segments.value.length === 0 ? LESSON_DEFAULT_START : ''),
      item: '',
      content: '',
      teacher_text: auth.profile?.display_name ?? '',
      materials_text: '',
      review_text: '',
    }
  }
}

// 開始時間改用時間滾輪選擇（手機上比小輸入框好按）
const timePickerOpen = ref(false)
const startCols = ref<string[]>(['14', '00'])

function openTimePicker() {
  const [h, m] = (draft.value.start || LESSON_DEFAULT_START).split(':')
  startCols.value = [h.padStart(2, '0'), (m ?? '00').padStart(2, '0')]
  timePickerOpen.value = true
}

function onTimeConfirm({ selectedValues }: { selectedValues: string[] }) {
  draft.value.start = selectedValues.join(':')
  timePickerOpen.value = false
}

function clearStart() {
  draft.value.start = ''
  timePickerOpen.value = false
}

/** 分鐘滾輪只列 5 分鐘刻度，減少捲動 */
function timeFilter(type: string, options: PickerOption[]): PickerOption[] {
  if (type === 'minute') return options.filter((o) => Number(o.value) % 5 === 0)
  return options
}

/**
 * 時間連動（v6 #5b）：以第一段的開始時間為錨，依各段分鐘數鏈式重算每段起訖；
 * 遇到沒填分鐘數的段落即中斷（無法推算結束時間）。只回寫有變動的段落。
 */
async function reflowTimes() {
  const list = await listLessonSegments(activeGroup.value, selectedDate.value)
  let start: string | null = null
  const updates: { id: string; time_text: string }[] = []
  for (const seg of list) {
    const t = parseTimeText(seg.time_text)
    if (t.minutes == null) break
    if (start == null) start = t.start || LESSON_DEFAULT_START
    const nextText = composeTimeText(t.minutes, start)
    if (nextText !== seg.time_text) updates.push({ id: seg.id, time_text: nextText })
    start = addToClock(start, t.minutes)
  }
  for (const u of updates) await updateLessonSegment(u.id, { time_text: u.time_text })
}

async function save() {
  if (!draft.value.item.trim() && !draft.value.content.trim()) {
    showFailToast('請至少填寫項目或內容')
    return
  }
  saving.value = true
  try {
    const base = {
      time_text: timePreview.value,
      item: draft.value.item.trim(),
      content: draft.value.content,
      teacher_text: draft.value.teacher_text,
      materials_text: draft.value.materials_text,
      review_text: draft.value.review_text,
      updated_by_name: auth.profile?.display_name ?? '',
    }
    if (editing.value === 'new') {
      await createLessonSegment({
        ...base,
        class_group_id: activeGroup.value,
        gathering_date: selectedDate.value,
        sort_order: (segments.value[segments.value.length - 1]?.sort_order ?? -1) + 1,
      })
    } else if (editing.value) {
      await updateLessonSegment(editing.value.id, base)
    }
    await reflowTimes()
    await load()
    showSuccessToast('已儲存')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}

/**
 * 複製此段落（v9 #5）：老師常要寫內容/老師/時間/教材相近的段落。
 * 插在原段落之後並把後面的順序往後挪；課後執行（review_text）屬當堂實況，不複製。
 * 複製完直接開啟新段落，接著改就好。
 */
const duplicating = ref(false)
async function duplicate() {
  const target = editing.value
  if (!target || target === 'new' || duplicating.value) return
  duplicating.value = true
  try {
    const idx = segments.value.findIndex((s) => s.id === target.id)
    for (const seg of segments.value.slice(idx + 1).reverse()) {
      await updateLessonSegment(seg.id, { sort_order: seg.sort_order + 1 })
    }
    const created = await createLessonSegment({
      class_group_id: activeGroup.value,
      gathering_date: selectedDate.value,
      time_text: target.time_text,
      item: target.item,
      content: target.content,
      teacher_text: target.teacher_text,
      materials_text: target.materials_text,
      review_text: '',
      sort_order: target.sort_order + 1,
      updated_by_name: auth.profile?.display_name ?? '',
    })
    await reflowTimes()
    await load()
    openEditor(segments.value.find((s) => s.id === created.id) ?? created)
    showSuccessToast('已複製，可直接修改')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    duplicating.value = false
  }
}

async function remove() {
  const target = editing.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({ title: '刪除段落', message: `確定刪除「${target.item || '此段落'}」？` })
  } catch {
    return
  }
  try {
    await deleteLessonSegment(target.id)
    await reflowTimes()
    await load()
    showSuccessToast('已刪除')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

/** 上下移動段落（sort_order 對調） */
async function move(seg: LessonSegment, dir: -1 | 1) {
  const idx = segments.value.findIndex((s) => s.id === seg.id)
  const other = segments.value[idx + dir]
  if (!other) return
  try {
    await Promise.all([
      updateLessonSegment(seg.id, { sort_order: other.sort_order }),
      updateLessonSegment(other.id, { sort_order: seg.sort_order }),
    ])
    await reflowTimes()
    await load()
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <h2>教案</h2>
    <p class="hint">每班每聚會日一份；各段落獨立填寫（不同老師編各自負責的段落）</p>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs" :color="activeClassColor">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <div class="date-row">
      <van-tag
        v-for="d in dates"
        :key="d"
        round
        size="large"
        :type="selectedDate === d ? 'primary' : 'default'"
        :plain="selectedDate !== d"
        @click="selectedDate = d"
      >
        {{ d.slice(5).replace('-', '/') }}
      </van-tag>
    </div>

    <van-button size="small" plain type="primary" class="export-btn" :loading="exporting"
      @click="exportQuarter">
      匯出近一季（12 週）教案
    </van-button>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div class="plan-head card">
        <div>
          <strong>{{ formatGathering(selectedDate) }}</strong>
          <p class="hint plan-sub">
            {{ segments.length ? `${segments.length} 個段落 · 總時長約 ${total} 分鐘` : '尚未建立教案' }}
          </p>
        </div>
        <van-button
          v-if="canEdit && segments.length > 0"
          size="small"
          plain
          type="primary"
          @click="openEditor(null)"
        >
          ＋段落
        </van-button>
      </div>

      <!-- 空白日：引導建立 -->
      <div v-if="segments.length === 0 && canEdit" class="card empty">
        <p class="empty-title">這一天還沒有教案</p>
        <p class="hint">可以套用標準流程再逐段修改，或從空白開始（範本來源：{{ templateSource }}）</p>
        <van-button
          round
          block
          type="primary"
          :loading="creatingTemplate"
          class="tpl-btn"
          @click="createFromTemplate"
        >
          ⚡ 以標準流程建立（{{ templateItems.length }} 段）
        </van-button>
        <van-button round block plain type="primary" @click="openEditor(null)">
          從空白新增第一段
        </van-button>
      </div>
      <div v-else-if="segments.length === 0" class="card hint">本日尚無教案內容</div>

      <!-- 時間軸 run sheet -->
      <div class="timeline">
        <div
          v-for="(seg, i) in segments"
          :key="seg.id"
          class="tl-row"
          :class="{ clickable: canEdit }"
          @click="openEditor(seg)"
        >
          <div class="tl-time">
            <strong>{{ timeOf(seg).min }}</strong>
            <span v-if="timeOf(seg).range">{{ timeOf(seg).range }}</span>
          </div>
          <div class="tl-axis">
            <i class="tl-dot" />
            <i v-if="i < segments.length - 1" class="tl-line" />
          </div>
          <div class="tl-card card">
            <div class="tl-head">
              <strong class="tl-item">{{ seg.item || '未命名段落' }}</strong>
              <van-tag v-if="seg.teacher_text" plain type="primary">{{ seg.teacher_text }}</van-tag>
              <span class="spacer" />
              <template v-if="canEdit">
                <button class="mv" :disabled="i === 0" @click.stop="move(seg, -1)">↑</button>
                <button
                  class="mv"
                  :disabled="i === segments.length - 1"
                  @click.stop="move(seg, 1)"
                >
                  ↓
                </button>
              </template>
            </div>
            <p v-if="seg.content" class="tl-content">{{ seg.content }}</p>
            <p v-else class="tl-content unfilled">（內容未填寫）</p>
            <p class="tl-field">
              <span class="f-label">🧰 教材預備</span>
              <span v-if="seg.materials_text">{{ seg.materials_text }}</span>
              <span v-else class="unfilled">未填寫</span>
            </p>
            <p class="tl-field">
              <span class="f-label">📝 課後執行</span>
              <span v-if="seg.review_text">{{ seg.review_text }}</span>
              <span v-else class="unfilled">未填寫</span>
            </p>
            <p v-if="seg.updated_by_name" class="hint upd">
              {{ seg.updated_by_name }} · {{ seg.updated_at.slice(0, 10) }}
            </p>
          </div>
        </div>
      </div>

      <p v-if="canEdit && segments.length > 0" class="hint foot-tip">
        點段落卡即可編輯該段（一段一存，不會蓋到其他老師的段落）
      </p>
      <p v-else-if="segments.length > 0" class="hint foot-tip">
        ※ 僅該班老師與同工可編輯；您目前為唯讀檢視。
      </p>
    </template>

    <van-popup
      :show="editing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增段落' : `編輯「${(editing as LessonSegment)?.item || '段落'}」` }}</h3>

        <p class="hint pop-label">項目</p>
        <div class="tag-row">
          <van-tag
            v-for="it in itemPresets"
            :key="it"
            round
            size="large"
            :type="draft.item === it ? 'primary' : 'default'"
            :plain="draft.item !== it"
            @click="draft.item = draft.item === it ? '' : it"
          >
            {{ it }}
          </van-tag>
        </div>
        <van-field v-model="draft.item" label="自訂項目" maxlength="40"
          placeholder="或自行輸入（如：防災演習）" />

        <p class="hint pop-label">
          時間{{ timePreview ? `：${timePreview}` : '（設定長度與開始時間自動計算）' }}
        </p>
        <div class="time-card">
          <div class="time-block">
            <span class="t-label">時間長度（分鐘）</span>
            <van-stepper
              v-model="draft.minutes"
              :min="0"
              :max="180"
              :step="5"
              theme="round"
              button-size="42px"
              input-width="64px"
            />
          </div>
          <button type="button" class="time-block time-btn" @click="openTimePicker">
            <span class="t-label">開始時間</span>
            <span class="t-value" :class="{ placeholder: !draft.start }">
              {{ draft.start || '點此選擇' }} ▾
            </span>
          </button>
        </div>

        <van-field v-model="draft.content" label="內容" type="textarea" rows="3" autosize
          maxlength="2000" placeholder="教學內容、流程說明、YouTube 連結…" />
        <van-field v-model="draft.teacher_text" label="老師" maxlength="60"
          placeholder="此段落負責老師" />
        <van-field v-model="draft.materials_text" label="教材預備" type="textarea" rows="1" autosize
          maxlength="500" placeholder="需要準備的教材／物品" />
        <van-field v-model="draft.review_text" label="課後執行" type="textarea" rows="1" autosize
          maxlength="500" placeholder="課後執行記錄（改善&建議，課後補填）" />

        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
          儲存此段落
        </van-button>
        <van-button v-if="editing !== 'new'" round block plain type="primary" class="dup-btn"
          :loading="duplicating" @click="duplicate">
          複製此段落
        </van-button>
        <van-button v-if="editing !== 'new'" round block plain type="danger" class="del-btn" @click="remove">
          刪除段落
        </van-button>
      </div>
    </van-popup>

    <!-- 開始時間滾輪（5 分鐘刻度） -->
    <van-popup
      :show="timePickerOpen"
      round
      position="bottom"
      @update:show="(v: boolean) => (timePickerOpen = v)"
    >
      <div class="picker-wrap">
        <van-time-picker
          v-model="startCols"
          title="開始時間"
          :filter="timeFilter"
          @confirm="onTimeConfirm"
          @cancel="timePickerOpen = false"
        />
        <van-button plain block size="small" class="clear-time-btn" @click="clearStart">
          不指定開始時間（只填長度）
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.export-btn {
  margin: 4px 0 10px;
}
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.tabs {
  margin: 12px 0;
}
.date-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 10px;
}
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.plan-head strong {
  font-size: 20px;
}
.plan-sub {
  margin: 4px 0 0;
}
.empty {
  text-align: center;
  padding: 24px 16px;
}
.empty-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}
.tpl-btn {
  margin: 14px 0 10px;
}

/* ---- 時間軸 run sheet ---- */
.timeline {
  margin-top: 4px;
}
.tl-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.tl-row.clickable {
  cursor: pointer;
}
.tl-time {
  width: 66px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 14px;
  gap: 2px;
}
.tl-time strong {
  font-size: 22px;
  color: var(--kll-primary-dark);
  line-height: 1.1;
}
.tl-time span {
  font-size: 13px;
  color: var(--kll-sub);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.tl-axis {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}
.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--kll-primary);
  flex-shrink: 0;
}
.tl-line {
  width: 3px;
  flex: 1;
  background: var(--kll-primary-soft);
  border-radius: 2px;
  margin-top: 2px;
}
.tl-card {
  flex: 1;
  min-width: 0;
  margin-bottom: 10px;
}
.tl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tl-item {
  font-size: 22px;
}
.spacer {
  flex: 1;
}
.mv {
  width: 36px;
  height: 34px;
  border: 1px solid var(--kll-line);
  border-radius: 8px;
  background: var(--kll-bg);
  font-size: 17px;
}
.mv:disabled {
  opacity: 0.35;
}
.tl-content {
  margin: 8px 0 0;
  font-size: 18px;
  white-space: pre-wrap;
}
.tl-field {
  margin: 8px 0 0;
  font-size: 16px;
  background: var(--kll-bg);
  border-radius: 8px;
  padding: 6px 10px;
}
.f-label {
  color: var(--kll-sub);
  margin-right: 8px;
  font-size: 15px;
}
.unfilled {
  color: var(--kll-sub);
  font-style: italic;
  opacity: 0.75;
}
.upd {
  margin: 8px 0 0;
  font-size: 13px;
}
.foot-tip {
  margin-top: 4px;
}

/* ---- 編輯彈窗 ---- */
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 12px;
  text-align: center;
  font-size: 22px;
}
.pop-label {
  margin: 10px 16px 6px;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 16px 8px;
}
/* 時間輸入：大點擊目標（手機優先） */
.time-card {
  display: flex;
  gap: 10px;
  margin: 0 16px 6px;
}
.time-block {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--kll-line);
  border-radius: 12px;
  background: #fffdfb;
  padding: 10px 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.time-btn {
  font: inherit;
  cursor: pointer;
}
.time-btn:active {
  background: var(--kll-primary-soft);
}
.t-label {
  font-size: 15px;
  color: var(--kll-sub);
}
.t-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--kll-primary-dark);
  font-variant-numeric: tabular-nums;
  line-height: 42px;
}
.t-value.placeholder {
  font-size: 17px;
  font-weight: 400;
  color: var(--kll-sub);
}
.picker-wrap {
  padding-bottom: 16px;
}
.clear-time-btn {
  margin: 0 16px;
  width: calc(100% - 32px);
}
.save-btn {
  margin-top: 14px;
}
.dup-btn {
  margin-top: 8px;
}
.del-btn {
  margin-top: 8px;
}
</style>
