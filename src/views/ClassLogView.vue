<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import { listSessionLogsRange, upsertSessionLog } from '../api/records'
import { listScheduledSongs, upsertFamiliarity } from '../api/songs'
import { classHasIndex } from '../lib/engagement'
import { FAMILIARITY_LEVELS } from '../lib/familiarity'
import {
  feedbackDeadline,
  isFeedbackOpen,
  lastGathering,
  weekdayName,
} from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, SessionLog, Song } from '../types'

const auth = useAuthStore()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const logs = ref<SessionLog[]>([])
const loading = ref(true)

const yearStart = `${new Date().getFullYear()}-01-01`
const today = lastGathering() // 最近一次聚會日（本堂）
const dueDate = feedbackDeadline(today)
const withinDue = isFeedbackOpen(today)

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
    activeGroup.value = groups.value[0]?.id ?? ''
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
    const songs = await listScheduledSongs(activeGroup.value, editDate.value)
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

async function save() {
  saving.value = true
  try {
    await upsertSessionLog({
      class_group_id: activeGroup.value,
      gathering_date: editDate.value,
      teacher_name: auth.profile?.display_name ?? '',
      ...draft.value,
    })
    // 熟悉度隨日誌一併儲存（班別 × 歌曲）
    for (const s of famSongs.value) {
      const f = famDraft.value[s.id]
      if (f) await upsertFamiliarity(s.id, activeGroup.value, f.song_level, f.motion_level)
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
    <p class="hint">教學內容、詩歌進度與課後反饋（給下一堂的老師），全年連貫呈現</p>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
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
        <p v-if="l.content"><span class="label">教學內容</span>{{ l.content }}</p>
        <p v-if="l.song_progress"><span class="label">詩歌進度</span>{{ l.song_progress }}</p>
        <p v-if="l.feedback" class="fb"><span class="label">課後反饋</span>{{ l.feedback }}</p>
      </div>
    </template>

    <van-popup
      :show="editing !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editDate }} 課堂紀錄</h3>
        <p class="hint">老師：{{ auth.profile?.display_name }}</p>
        <van-field v-model="draft.content" label="教學內容" type="textarea" rows="2" autosize
          maxlength="500" placeholder="今天教了什麼（經文、主題、活動）" />
        <van-field v-model="draft.song_progress" label="詩歌進度" type="textarea" rows="1" autosize
          maxlength="300" placeholder="練了哪些詩歌、進度到哪" />
        <van-field v-model="draft.feedback" label="課後反饋" type="textarea" rows="2" autosize
          maxlength="500" placeholder="給下一堂老師的提醒與交接" />

        <template v-if="showFam && famSongs.length > 0">
          <p class="hint fam-title">本堂歌單熟悉度（班級整體練習進度，不評比孩子）</p>
          <div v-for="s in famSongs" :key="s.id" class="fam-card">
            <strong class="fam-song">{{ s.title }}</strong>
            <div v-for="dim in (['song_level', 'motion_level'] as const)" :key="dim" class="fam-dim">
              <span class="fam-label">{{ dim === 'song_level' ? '歌曲' : '動作' }}</span>
              <van-tag
                v-for="lv in FAMILIARITY_LEVELS"
                :key="lv.value"
                round
                size="large"
                :type="famDraft[s.id]?.[dim] === lv.value ? 'primary' : 'default'"
                :plain="famDraft[s.id]?.[dim] !== lv.value"
                @click="setFam(s.id, dim, lv.value)"
              >
                {{ lv.label }}
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
  margin: 12px 0 16px;
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
