<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import { listSessionLogsRange, upsertSessionLog } from '../api/records'
import { listCurrentPlaylistSongs, upsertFamiliarity } from '../api/songs'
import { downloadCsv } from '../lib/csv'
import { FAMILIARITY_VALUES } from '../lib/familiarity'
import { classHasIndex } from '../lib/performance'
import {
  feedbackDeadline,
  isFeedbackOpen,
  lastGathering,
  recentGatherings,
  weekdayName,
} from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, SessionLog, Song } from '../types'
import { classColor } from '../lib/classColor'

const auth = useAuthStore()
const route = useRoute()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
/** 班別頁籤依班別上色（v9 #1）：兒童＝太陽色、幼童＝天藍、幼幼＝嫩綠 */
const activeClassColor = computed(() =>
  classColor(groups.value.find((g) => g.id === activeGroup.value)?.name),
)
const logs = ref<SessionLog[]>([])
const loading = ref(true)

const yearStart = `${new Date().getFullYear()}-01-01`
const today = lastGathering() // 最近一次聚會日（本堂）
const dueDate = feedbackDeadline(today)
const withinDue = isFeedbackOpen(today)
/** 可補寫的聚會日（v5 #7）：近 12 次（含本堂），新到舊供挑選 */
const backfillDates = recentGatherings(12).slice().reverse()

/** 目前班別的全年紀錄（新到舊，連貫呈現） */
const classLogs = computed(() =>
  logs.value.filter((l) => l.class_group_id === activeGroup.value),
)
const currentLog = computed(() =>
  classLogs.value.find((l) => l.gathering_date === today),
)

async function load() {
  loading.value = true
  try {
    logs.value = await listSessionLogsRange(yearStart, today)
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    groups.value = await listClassGroups()
    // 首頁提醒可帶 ?class=<班別 id> 直接切到那一班（v9 驗收回饋）
    const wanted = String(route.query.class ?? '')
    activeGroup.value =
      (wanted && groups.value.some((g) => g.id === wanted) ? wanted : groups.value[0]?.id) ?? ''
    await load()
  } catch (e) {
    showFailToast((e as Error).message)
    loading.value = false
  }
})

// ---- 填寫/編輯 ----
const editing = ref<SessionLog | null | 'new'>(null)
const draft = ref({ content: '', song_progress: '', feedback: '' })
const editDate = ref(today)
const saving = ref(false)

// ---- 詩歌熟悉度（v3 決議 5）：於日誌流程填寫；幼幼班老師不需填寫 ----
const famSongs = ref<Song[]>([])
/** songId → { song_level, motion_level } 草稿 */
const famDraft = ref<Record<string, { song_level: number | null; motion_level: number | null }>>({})
const showFam = computed(() =>
  classHasIndex(groups.value.find((g) => g.id === activeGroup.value)?.name),
)

async function loadFamSongs() {
  famSongs.value = []
  famDraft.value = {}
  if (!showFam.value) return
  try {
    const songs = await listCurrentPlaylistSongs(activeGroup.value, editDate.value)
    famSongs.value = songs
    for (const s of songs) {
      const f = (s.song_familiarity ?? []).find((x) => x.class_group_id === activeGroup.value)
      famDraft.value[s.id] = {
        song_level: f?.song_level ?? null,
        motion_level: f?.motion_level ?? null,
      }
    }
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

function setFam(songId: string, dim: 'song_level' | 'motion_level', value: number) {
  const cur = famDraft.value[songId]
  if (!cur) return
  cur[dim] = cur[dim] === value ? null : value // 點同一級＝取消
}

function openEditor(log: SessionLog | null) {
  if (log) {
    editing.value = log
    editDate.value = log.gathering_date
    draft.value = { content: log.content, song_progress: log.song_progress, feedback: log.feedback }
  } else {
    editing.value = 'new'
    editDate.value = today
    draft.value = { content: '', song_progress: '', feedback: '' }
  }
  loadFamSongs()
}

/** 補寫（v5 #7）：於編輯彈窗切換聚會日；已有紀錄的日期帶入該筆內容 */
function pickDate(d: string) {
  if (d === editDate.value) return
  editDate.value = d
  const existing = classLogs.value.find((l) => l.gathering_date === d)
  if (existing) {
    editing.value = existing
    draft.value = {
      content: existing.content,
      song_progress: existing.song_progress,
      feedback: existing.feedback,
    }
  } else {
    editing.value = 'new'
    draft.value = { content: '', song_progress: '', feedback: '' }
  }
  loadFamSongs()
}

/** 匯出本年課堂紀錄（自出席紀錄頁移入——v5 #6 動線調整） */
function exportLogs() {
  const rows: string[][] = [['日期', '班別', '老師', '課後反饋']]
  const groupName = (id: string) => groups.value.find((g) => g.id === id)?.name ?? ''
  for (const l of [...logs.value].sort((a, b) => a.gathering_date.localeCompare(b.gathering_date))) {
    rows.push([l.gathering_date, groupName(l.class_group_id), l.teacher_name, l.feedback])
  }
  downloadCsv(`課堂紀錄_${yearStart}_${today}.csv`, rows)
  showSuccessToast('已匯出，可存至教會 NAS 或匯入 Google Sheet')
}

async function save() {
  saving.value = true
  try {
    await upsertSessionLog({
      class_group_id: activeGroup.value,
      gathering_date: editDate.value,
      teacher_name: auth.profile?.display_name ?? '',
      ...draft.value,
    })
    // 熟悉度隨日誌一併儲存（班別 × 歌曲）；上課日期＝本堂日期
    for (const s of famSongs.value) {
      const f = famDraft.value[s.id]
      if (f)
        await upsertFamiliarity(
          s.id,
          activeGroup.value,
          f.song_level,
          f.motion_level,
          auth.profile?.display_name ?? '',
          editDate.value,
        )
    }
    await load()
    showSuccessToast('已儲存')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h2>課堂紀錄</h2>
    <p class="hint">課後反饋與交接（給下一堂的老師）＋詩歌熟悉度，全年連貫呈現</p>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs" :color="activeClassColor">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <van-notice-bar
      v-if="auth.canClass(activeGroup) && withinDue && !currentLog"
      left-icon="edit"
      :text="`本堂（${today}）尚未填寫，請於 ${dueDate.toLocaleDateString('zh-TW')}（${weekdayName(dueDate)}）23:59 前完成`"
    />

    <!-- 老師標籤班別化：僅能填寫/編輯自己被指派的班別；其他班別可閱讀 -->
    <van-button
      v-if="auth.canClass(activeGroup)"
      round
      block
      type="primary"
      class="fill-btn"
      @click="openEditor(currentLog ?? null)"
    >
      {{ currentLog ? `編輯本堂紀錄（${today}）` : `填寫本堂紀錄（${today}）` }}
    </van-button>
    <p v-if="auth.canClass(activeGroup)" class="hint backfill-tip">
      漏填先前的課堂？點上方按鈕後，在彈窗內切換聚會日即可補寫。
    </p>

    <div class="export-row">
      <van-button size="small" type="primary" plain @click="exportLogs">
        匯出課堂紀錄（本年）
      </van-button>
    </div>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="classLogs.length === 0" class="card hint">本年度尚無紀錄</div>
      <div
        v-for="l in classLogs"
        :key="l.id"
        class="card"
        @click="auth.canClass(activeGroup) && openEditor(l)"
      >
        <div class="log-head">
          <strong>{{ l.gathering_date }}</strong>
          <span class="hint">{{ l.teacher_name }}</span>
        </div>
        <p v-if="l.feedback" class="fb"><span class="label">課後反饋</span>{{ l.feedback }}</p>
        <p v-if="!l.feedback" class="hint">（尚未填寫課後反饋）</p>
      </div>
    </template>

    <van-popup
      :show="editing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editDate }} 課堂紀錄</h3>
        <p class="hint">老師：{{ auth.profile?.display_name }}</p>

        <!-- 補寫日期切換（v5 #7）：✓＝該日已有紀錄，點選帶入編輯 -->
        <div class="date-row">
          <van-tag
            v-for="d in backfillDates"
            :key="d"
            round
            size="large"
            :type="editDate === d ? 'primary' : 'default'"
            :plain="editDate !== d"
            @click="pickDate(d)"
          >
            {{ classLogs.some((l) => l.gathering_date === d) ? '✓ ' : '' }}{{ d.slice(5).replace('-', '/') }}
          </van-tag>
        </div>
        <!-- v6 #3：教學內容/詩歌進度欄位停用（教學內容看教案、詩歌進度看熟悉度）；舊資料保留不動 -->
        <van-field v-model="draft.feedback" label="課後反饋" type="textarea" rows="3" autosize
          maxlength="500" placeholder="給下一堂老師的提醒與交接" />

        <template v-if="showFam && famSongs.length > 0">
          <p class="hint fam-title">本堂歌單熟悉度（1＝不熟、5＝熟悉；班級整體練習進度，不評比孩子）</p>
          <div v-for="s in famSongs" :key="s.id" class="fam-card">
            <strong class="fam-song">{{ s.title }}</strong>
            <div v-for="dim in (['song_level', 'motion_level'] as const)" :key="dim" class="fam-dim">
              <span class="fam-label">{{ dim === 'song_level' ? '歌曲' : '動作' }}</span>
              <van-tag
                v-for="v in FAMILIARITY_VALUES"
                :key="v"
                round
                size="large"
                :type="famDraft[s.id]?.[dim] === v ? 'primary' : 'default'"
                :plain="famDraft[s.id]?.[dim] !== v"
                @click="setFam(s.id, dim, v)"
              >
                {{ v }}
              </van-tag>
            </div>
          </div>
        </template>

        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
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
.fill-btn {
  margin: 12px 0 8px;
}
.backfill-tip {
  margin: 0 0 10px;
}
.export-row {
  margin: 0 0 14px;
}
.date-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 8px;
  margin: 6px 0 4px;
}
.date-row .van-tag {
  flex-shrink: 0;
}
.log-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.card p {
  margin: 6px 0 0;
  font-size: 18px;
}
.label {
  color: var(--kll-sub);
  font-size: 17px;
  margin-right: 8px;
}
.fb {
  background: var(--kll-primary-soft);
  border-radius: 8px;
  padding: 6px 10px;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 4px;
  text-align: center;
  font-size: 22px;
}
.editor .hint {
  text-align: center;
  margin-bottom: 10px;
}
.save-btn {
  margin-top: 14px;
}
.fam-title {
  margin: 14px 16px 6px;
}
.fam-card {
  margin: 0 16px 10px;
  padding: 10px 12px;
  background: var(--kll-bg);
  border-radius: 10px;
}
.fam-song {
  display: block;
  margin-bottom: 6px;
}
.fam-dim {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.fam-label {
  width: 40px;
  color: var(--kll-sub);
  font-size: 15px;
}
</style>
