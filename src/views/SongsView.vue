<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createSong,
  deleteSong,
  listSongs,
  setSongSchedule,
  updateSong,
} from '../api/songs'
import { familiarityLabel } from '../lib/familiarity'
import { formatGathering, nextGathering, upcomingGathering } from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, Song } from '../types'

const auth = useAuthStore()
const thisWeek = upcomingGathering()
const nextWeek = nextGathering()

const songs = ref<Song[]>([])
const groups = ref<ClassGroup[]>([])
const loading = ref(true)
const openLyrics = ref<string[]>([])

const groupName = computed(() => new Map(groups.value.map((g) => [g.id, g.name])))

async function load() {
  loading.value = true
  try {
    ;[songs.value, groups.value] = await Promise.all([listSongs(), listClassGroups()])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 「本週兒童班」「下週幼幼班」標籤（其餘週次不顯示，歷史保留於資料） */
function weekTags(song: Song): { key: string; text: string; isThisWeek: boolean }[] {
  const tags: { key: string; text: string; isThisWeek: boolean }[] = []
  for (const sc of song.song_schedule ?? []) {
    const week =
      sc.gathering_date === thisWeek ? '本週' : sc.gathering_date === nextWeek ? '下週' : null
    if (!week) continue
    const name = groupName.value.get(sc.class_group_id) ?? ''
    tags.push({ key: sc.id, text: `${week}${name}`, isThisWeek: week === '本週' })
  }
  return tags.sort((a, b) => Number(b.isThisWeek) - Number(a.isThisWeek))
}

/** 各班熟悉度顯示（幼幼班不填不顯示） */
function familiarityRows(song: Song): { key: string; name: string; text: string }[] {
  return (song.song_familiarity ?? [])
    .filter((f) => f.song_level != null || f.motion_level != null)
    .map((f) => {
      const name = groupName.value.get(f.class_group_id) ?? ''
      const parts: string[] = []
      const song_ = familiarityLabel(f.song_level)
      const motion = familiarityLabel(f.motion_level)
      if (song_) parts.push(`歌曲 ${song_}`)
      if (motion) parts.push(`動作 ${motion}`)
      return { key: f.class_group_id, name, text: parts.join('・') }
    })
    .filter((r) => r.text)
}

function openUrl(url: string | null) {
  if (url) window.open(url, '_blank')
}

// ---- 管理端：新增/編輯/刪除＋本週/下週排程 ----
const editing = ref<Song | 'new' | null>(null)
const draft = ref({ title: '', youtube_url: '', dance_url: '', lyrics: '' })
/** 排程勾選：`${date}|${classId}` */
const draftSchedule = ref<Set<string>>(new Set())
const saving = ref(false)

const scheduleWeeks = computed(() => [
  { date: thisWeek, label: `本週（${formatGathering(thisWeek)}）` },
  { date: nextWeek, label: `下週（${formatGathering(nextWeek)}）` },
])

function openEditor(s: Song | null) {
  if (!auth.can('admin')) return
  editing.value = s ?? 'new'
  draft.value = s
    ? {
        title: s.title,
        youtube_url: s.youtube_url ?? '',
        dance_url: s.dance_url ?? '',
        lyrics: s.lyrics ?? '',
      }
    : { title: '', youtube_url: '', dance_url: '', lyrics: '' }
  const set = new Set<string>()
  for (const sc of s?.song_schedule ?? []) {
    if (sc.gathering_date === thisWeek || sc.gathering_date === nextWeek)
      set.add(`${sc.gathering_date}|${sc.class_group_id}`)
  }
  draftSchedule.value = set
}

function toggleSchedule(date: string, classId: string) {
  const key = `${date}|${classId}`
  const set = new Set(draftSchedule.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  draftSchedule.value = set
}

async function save() {
  if (!draft.value.title.trim()) {
    showFailToast('請填寫歌名')
    return
  }
  saving.value = true
  try {
    const input = {
      title: draft.value.title.trim(),
      youtube_url: draft.value.youtube_url.trim() || null,
      dance_url: draft.value.dance_url.trim() || null,
      lyrics: draft.value.lyrics.trim() || null,
    }
    let songId: string
    if (editing.value === 'new') {
      songId = await createSong(input)
    } else {
      songId = (editing.value as Song).id
      await updateSong(songId, input)
    }
    const entries = [...draftSchedule.value].map((key) => {
      const [gathering_date, class_group_id] = key.split('|')
      return { gathering_date, class_group_id }
    })
    await setSongSchedule(songId, [thisWeek, nextWeek], entries)
    await load()
    showSuccessToast('已儲存')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}

async function remove() {
  const target = editing.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({ title: '刪除歌曲', message: `確定刪除「${target.title}」？` })
  } catch {
    return
  }
  try {
    await deleteSong(target.id)
    await load()
    showSuccessToast('已刪除')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <div class="section-row">
      <div>
        <h2>敬拜詩歌</h2>
        <p class="hint">曲庫可一次上傳整學期；「本週/下週」標籤依班別排程 🎵</p>
      </div>
      <van-button v-if="auth.can('admin')" size="small" type="primary" plain @click="openEditor(null)">
        ＋新增
      </van-button>
    </div>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div v-if="songs.length === 0" class="card hint">曲庫尚無歌曲</div>
      <div v-for="s in songs" :key="s.id" class="card">
        <div class="song-head">
          <strong class="title">{{ s.title }}</strong>
          <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(s)">編輯</van-button>
        </div>
        <div v-if="weekTags(s).length" class="week-tags">
          <van-tag
            v-for="t in weekTags(s)"
            :key="t.key"
            round
            :type="t.isThisWeek ? 'primary' : 'success'"
            :plain="!t.isThisWeek"
          >
            {{ t.text }}的詩歌
          </van-tag>
        </div>
        <div class="song-actions">
          <van-button
            v-if="s.youtube_url"
            size="small"
            type="danger"
            plain
            icon="play-circle-o"
            @click="openUrl(s.youtube_url)"
          >
            詩歌
          </van-button>
          <van-button
            v-if="s.dance_url"
            size="small"
            type="warning"
            plain
            icon="play-circle-o"
            @click="openUrl(s.dance_url)"
          >
            舞蹈
          </van-button>
          <van-button
            v-if="s.lyrics"
            size="small"
            plain
            @click="
              openLyrics = openLyrics.includes(s.id)
                ? openLyrics.filter((x) => x !== s.id)
                : [...openLyrics, s.id]
            "
          >
            {{ openLyrics.includes(s.id) ? '收合歌詞' : '看歌詞' }}
          </van-button>
        </div>
        <p v-if="familiarityRows(s).length" class="fam-rows hint">
          <span v-for="r in familiarityRows(s)" :key="r.key" class="fam-row">
            {{ r.name }}：{{ r.text }}
          </span>
        </p>
        <p v-if="openLyrics.includes(s.id)" class="lyrics">{{ s.lyrics }}</p>
      </div>
      <p v-if="songs.length" class="hint foot-note">
        熟悉度（歌曲/動作）由各班老師於「課堂紀錄」填寫，是班級整體練習進度，不評比個別孩子。
      </p>
    </template>

    <van-popup
      :show="editing !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增歌曲' : '編輯歌曲' }}</h3>
        <van-field v-model="draft.title" label="歌名" maxlength="80" placeholder="例：耶穌喜愛小孩" />
        <van-field v-model="draft.youtube_url" label="詩歌影片" type="url"
          placeholder="https://youtube.com/…（純歌詞版佳）" />
        <van-field v-model="draft.dance_url" label="舞蹈影片" type="url"
          placeholder="https://youtube.com/…（動作教學）" />
        <van-field v-model="draft.lyrics" label="歌詞" type="textarea" rows="4" autosize
          maxlength="3000" placeholder="貼上歌詞（選填）" />

        <div v-for="w in scheduleWeeks" :key="w.date" class="sched-block">
          <p class="hint sched-title">{{ w.label }}</p>
          <div class="sched-tags">
            <van-tag
              v-for="g in groups"
              :key="g.id"
              round
              size="large"
              :type="draftSchedule.has(`${w.date}|${g.id}`) ? 'primary' : 'default'"
              :plain="!draftSchedule.has(`${w.date}|${g.id}`)"
              @click="toggleSchedule(w.date, g.id)"
            >
              {{ g.name }}
            </van-tag>
          </div>
        </div>
        <p class="hint">未勾選任何班別＝只存入曲庫，之後隨時可排入歌單</p>

        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
          儲存
        </van-button>
        <van-button v-if="editing !== 'new'" round block plain type="danger" class="del-btn" @click="remove">
          刪除
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
.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.song-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title {
  flex: 1;
  font-size: 21px;
}
.week-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.song-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.fam-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 10px 0 0;
}
.lyrics {
  margin: 10px 0 0;
  padding: 10px 12px;
  background: var(--kll-bg);
  border-radius: 10px;
  font-size: 18px;
  white-space: pre-wrap;
  color: var(--kll-text);
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
.sched-block {
  margin: 12px 16px 0;
}
.sched-title {
  margin: 0 0 6px;
}
.sched-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.editor > .hint {
  margin: 10px 16px 0;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
