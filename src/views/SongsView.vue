<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createPlaylist,
  createSong,
  deletePlaylist,
  deleteSong,
  listPlaylists,
  listSongs,
  setPlaylistSongs,
  updatePlaylist,
  updateSong,
  upsertFamiliarity,
} from '../api/songs'
import { FAMILIARITY_VALUES, familiarityText } from '../lib/familiarity'
import { classHasIndex } from '../lib/performance'
import { upcomingGathering } from '../lib/gathering'
import { normalizeUrl } from '../lib/url'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, Song, SongFamiliarity, SongPlaylist } from '../types'

const auth = useAuthStore()
const today = upcomingGathering()

const songs = ref<Song[]>([])
const playlists = ref<SongPlaylist[]>([])
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const loading = ref(true)
const openLyrics = ref<string[]>([])

const songById = computed(() => new Map(songs.value.map((s) => [s.id, s])))

async function load() {
  loading.value = true
  try {
    const [allSongs, allPlaylists, allGroups] = await Promise.all([
      listSongs(),
      listPlaylists(),
      listClassGroups(),
    ])
    songs.value = allSongs
    playlists.value = allPlaylists
    // 幼幼班無詩歌模組（只有點名＋老師課後紀錄）——不顯示頁籤
    groups.value = allGroups.filter((g) => classHasIndex(g.name))
    if (!activeGroup.value) activeGroup.value = groups.value[0]?.id ?? ''
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 目前班別的「當期歌單」（今日落在期間內；如同 Excel 雙月固定歌單） */
const currentPlaylist = computed(() =>
  playlists.value.find(
    (pl) =>
      pl.class_group_id === activeGroup.value &&
      pl.start_date <= today &&
      pl.end_date >= today,
  ),
)
const currentSongs = computed<Song[]>(() =>
  (currentPlaylist.value?.playlist_songs ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ps) => songById.value.get(ps.song_id))
    .filter((s): s is Song => Boolean(s)),
)
/** 本週歌曲（v6 #1：歌單內勾選多首，置頂顯示） */
const weeklyIds = computed(
  () =>
    new Set(
      (currentPlaylist.value?.playlist_songs ?? [])
        .filter((ps) => ps.is_weekly)
        .map((ps) => ps.song_id),
    ),
)
const weeklySongs = computed(() => currentSongs.value.filter((s) => weeklyIds.value.has(s.id)))
const restSongs = computed(() => currentSongs.value.filter((s) => !weeklyIds.value.has(s.id)))
/** 曲庫其餘歌曲（敬拜過的歌單；新→舊） */
const otherSongs = computed(() => {
  const inCurrent = new Set(currentSongs.value.map((s) => s.id))
  return songs.value.filter((s) => !inCurrent.has(s.id))
})

/** 目前班別對某歌的熟悉度紀錄 */
function famOf(song: Song): SongFamiliarity | undefined {
  return (song.song_familiarity ?? []).find((f) => f.class_group_id === activeGroup.value)
}
function famLine(song: Song): string | null {
  const f = famOf(song)
  if (!f) return null
  const parts: string[] = []
  const sing = familiarityText(f.song_level)
  const motion = familiarityText(f.motion_level)
  if (sing) parts.push(`歌唱 ${sing}`)
  if (motion) parts.push(`動作 ${motion}`)
  if (parts.length === 0) return null
  const meta: string[] = []
  if (f.updated_by_name) meta.push(f.updated_by_name)
  if (f.updated_at) meta.push(`填寫 ${f.updated_at.slice(0, 10)}`)
  if (f.last_practiced_on) meta.push(`上課 ${f.last_practiced_on}`)
  return `${parts.join('・')}${meta.length ? `（${meta.join(' · ')}）` : ''}`
}

const activeGroupName = computed(
  () => groups.value.find((g) => g.id === activeGroup.value)?.name ?? '',
)
/** 這個班別可否填熟悉度（幼幼班不填；老師需被指派、同工皆可） */
const canEditFam = computed(
  () =>
    classHasIndex(activeGroupName.value) &&
    (auth.can('admin') || auth.canClass(activeGroup.value)),
)

/**
 * 連結改用 <a target="_blank">（v9 #6）。
 * 原本以 window.open 由程式開視窗，遇到頁面處於舊版/異常狀態或瀏覽器封鎖快顯時會靜默失效；
 * 真實連結導覽不受這些影響，也支援長按/右鍵「在新分頁開啟」。
 */
function linkOf(url: string | null) {
  return normalizeUrl(url)
}
function toggleLyrics(id: string) {
  openLyrics.value = openLyrics.value.includes(id)
    ? openLyrics.value.filter((x) => x !== id)
    : [...openLyrics.value, id]
}

// ---- 熟悉度編輯（v4 決議 3：老師可於詩歌頁直接編輯；記錄於曲目上）----
const famEditing = ref<Song | null>(null)
const famDraft = ref<{ song_level: number | null; motion_level: number | null }>({
  song_level: null,
  motion_level: null,
})
const famSaving = ref(false)

function openFamEditor(song: Song) {
  famEditing.value = song
  const f = famOf(song)
  famDraft.value = { song_level: f?.song_level ?? null, motion_level: f?.motion_level ?? null }
}

function setFam(dim: 'song_level' | 'motion_level', value: number) {
  famDraft.value[dim] = famDraft.value[dim] === value ? null : value
}

async function saveFam() {
  const song = famEditing.value
  if (!song) return
  famSaving.value = true
  try {
    await upsertFamiliarity(
      song.id,
      activeGroup.value,
      famDraft.value.song_level,
      famDraft.value.motion_level,
      auth.profile?.display_name ?? '',
    )
    await load()
    showSuccessToast('已儲存')
    famEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    famSaving.value = false
  }
}

// ---- 管理端：歌曲（曲庫）----
const editing = ref<Song | 'new' | null>(null)
const draft = ref({ title: '', dance_url: '', youtube_url: '', lyrics: '' })
const saving = ref(false)

function openEditor(s: Song | null) {
  if (!auth.can('admin')) return
  editing.value = s ?? 'new'
  draft.value = s
    ? {
        title: s.title,
        dance_url: s.dance_url ?? '',
        youtube_url: s.youtube_url ?? '',
        lyrics: s.lyrics ?? '',
      }
    : { title: '', dance_url: '', youtube_url: '', lyrics: '' }
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
      dance_url: normalizeUrl(draft.value.dance_url) || null,
      youtube_url: normalizeUrl(draft.value.youtube_url) || null,
      lyrics: draft.value.lyrics.trim() || null,
    }
    if (editing.value === 'new') await createSong(input)
    else if (editing.value) await updateSong(editing.value.id, input)
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

// ---- 管理端：歌單期間（如「2026年7-8月」）----
const plEditing = ref<SongPlaylist | 'new' | null>(null)
const plDraft = ref({ title: '', start_date: '', end_date: '' })
/** 勾選順序即歌單順序 */
const plSongIds = ref<string[]>([])
/** 本週歌曲（可複選；v6 #1） */
const plWeeklyIds = ref<string[]>([])
const plSaving = ref(false)

function togglePlWeekly(id: string) {
  plWeeklyIds.value = plWeeklyIds.value.includes(id)
    ? plWeeklyIds.value.filter((x) => x !== id)
    : [...plWeeklyIds.value, id]
}

function openPlEditor() {
  if (!auth.can('admin')) return
  const pl = currentPlaylist.value
  plEditing.value = pl ?? 'new'
  plDraft.value = pl
    ? { title: pl.title, start_date: pl.start_date, end_date: pl.end_date }
    : { title: '', start_date: '', end_date: '' }
  plSongIds.value = pl
    ? (pl.playlist_songs ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ps) => ps.song_id)
    : []
  plWeeklyIds.value = pl
    ? (pl.playlist_songs ?? []).filter((ps) => ps.is_weekly).map((ps) => ps.song_id)
    : []
}

function togglePlSong(id: string) {
  if (plSongIds.value.includes(id)) {
    plSongIds.value = plSongIds.value.filter((x) => x !== id)
    plWeeklyIds.value = plWeeklyIds.value.filter((x) => x !== id)
  } else {
    plSongIds.value = [...plSongIds.value, id]
  }
}

async function savePl() {
  if (!plDraft.value.title.trim() || !plDraft.value.start_date || !plDraft.value.end_date) {
    showFailToast('請填寫歌單名稱與起訖日期（YYYY-MM-DD）')
    return
  }
  plSaving.value = true
  try {
    const input = {
      class_group_id: activeGroup.value,
      title: plDraft.value.title.trim(),
      start_date: plDraft.value.start_date,
      end_date: plDraft.value.end_date,
    }
    let id: string
    if (plEditing.value === 'new') id = await createPlaylist(input)
    else {
      id = (plEditing.value as SongPlaylist).id
      await updatePlaylist(id, input)
    }
    await setPlaylistSongs(
      id,
      plSongIds.value.map((song_id) => ({
        song_id,
        is_weekly: plWeeklyIds.value.includes(song_id),
      })),
    )
    await load()
    showSuccessToast('歌單已儲存')
    plEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    plSaving.value = false
  }
}

async function removePl() {
  const target = plEditing.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({ title: '刪除歌單', message: `確定刪除「${target.title}」？（曲庫歌曲不受影響）` })
  } catch {
    return
  }
  try {
    await deletePlaylist(target.id)
    await load()
    showSuccessToast('已刪除')
    plEditing.value = null
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
        <p class="hint">各班歌單依期間發布（如雙月更新）；曲庫可一次上傳整學期 🎵</p>
      </div>
      <van-button v-if="auth.can('admin')" size="small" type="primary" plain @click="openEditor(null)">
        ＋新增歌曲
      </van-button>
    </div>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div class="section-row">
        <h3 class="section-title">
          {{ currentPlaylist ? `${currentPlaylist.title}歌單` : '當期歌單' }}
        </h3>
        <van-button v-if="auth.can('admin')" size="small" plain @click="openPlEditor">
          {{ currentPlaylist ? '編輯歌單' : '建立歌單' }}
        </van-button>
      </div>
      <div v-if="currentSongs.length === 0" class="card hint">
        {{ activeGroupName }}目前沒有發布中的歌單
      </div>

      <!-- 本週歌曲（v6 #1：歌單內勾選、置頂顯示） -->
      <template v-if="weeklySongs.length > 0">
        <div v-for="s in weeklySongs" :key="'w' + s.id" class="card weekly-card">
          <div class="song-head">
            <van-tag type="warning" class="weekly-tag">本週歌曲</van-tag>
            <strong class="title">{{ s.title }}</strong>
            <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(s)">編輯</van-button>
          </div>
          <div class="song-actions">
            <a v-if="linkOf(s.dance_url)" class="link-btn dance" :href="linkOf(s.dance_url)"
              target="_blank" rel="noopener noreferrer">
              <van-icon name="play-circle-o" />有動作
            </a>
            <a v-if="linkOf(s.youtube_url)" class="link-btn lyric" :href="linkOf(s.youtube_url)"
              target="_blank" rel="noopener noreferrer">
              <van-icon name="play-circle-o" />純歌詞
            </a>
            <van-button v-if="s.lyrics" size="small" plain @click="toggleLyrics(s.id)">
              {{ openLyrics.includes(s.id) ? '收合歌詞' : '看歌詞' }}
            </van-button>
            <van-button v-if="canEditFam" size="small" plain type="primary" @click="openFamEditor(s)">
              熟悉度
            </van-button>
          </div>
          <p v-if="famLine(s)" class="hint fam-line">{{ famLine(s) }}</p>
          <p v-if="openLyrics.includes(s.id)" class="lyrics">{{ s.lyrics }}</p>
        </div>
      </template>

      <div v-for="(s, i) in restSongs" :key="s.id" class="card">
        <div class="song-head">
          <span class="num">{{ i + 1 }}</span>
          <strong class="title">{{ s.title }}</strong>
          <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(s)">編輯</van-button>
        </div>
        <div class="song-actions">
          <a v-if="linkOf(s.dance_url)" class="link-btn dance" :href="linkOf(s.dance_url)"
            target="_blank" rel="noopener noreferrer">
            <van-icon name="play-circle-o" />有動作
          </a>
          <a v-if="linkOf(s.youtube_url)" class="link-btn lyric" :href="linkOf(s.youtube_url)"
            target="_blank" rel="noopener noreferrer">
            <van-icon name="play-circle-o" />純歌詞
          </a>
          <van-button v-if="s.lyrics" size="small" plain @click="toggleLyrics(s.id)">
            {{ openLyrics.includes(s.id) ? '收合歌詞' : '看歌詞' }}
          </van-button>
          <van-button v-if="canEditFam" size="small" plain type="primary" @click="openFamEditor(s)">
            熟悉度
          </van-button>
        </div>
        <p v-if="famLine(s)" class="hint fam-line">{{ famLine(s) }}</p>
        <p v-if="openLyrics.includes(s.id)" class="lyrics">{{ s.lyrics }}</p>
      </div>

      <h3 class="section-title">所有歌曲（敬拜過的歌單）</h3>
      <div v-if="otherSongs.length === 0" class="card hint">曲庫沒有其他歌曲</div>
      <div v-for="s in otherSongs" :key="s.id" class="card">
        <div class="song-head">
          <strong class="title">{{ s.title }}</strong>
          <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(s)">編輯</van-button>
        </div>
        <div class="song-actions">
          <a v-if="linkOf(s.dance_url)" class="link-btn dance" :href="linkOf(s.dance_url)"
            target="_blank" rel="noopener noreferrer">
            <van-icon name="play-circle-o" />有動作
          </a>
          <a v-if="linkOf(s.youtube_url)" class="link-btn lyric" :href="linkOf(s.youtube_url)"
            target="_blank" rel="noopener noreferrer">
            <van-icon name="play-circle-o" />純歌詞
          </a>
          <van-button v-if="s.lyrics" size="small" plain @click="toggleLyrics(s.id)">
            {{ openLyrics.includes(s.id) ? '收合歌詞' : '看歌詞' }}
          </van-button>
          <van-button v-if="canEditFam" size="small" plain type="primary" @click="openFamEditor(s)">
            熟悉度
          </van-button>
        </div>
        <p v-if="famLine(s)" class="hint fam-line">{{ famLine(s) }}</p>
        <p v-if="openLyrics.includes(s.id)" class="lyrics">{{ s.lyrics }}</p>
      </div>

      <p class="hint foot-note">
        熟悉度（歌唱/動作，1＝不熟、5＝熟悉）由各班老師於詩歌頁或「課堂紀錄」填寫，
        是班級整體練習進度，不評比個別孩子；幼幼班不需填寫。
      </p>
    </template>

    <!-- 歌曲編輯（曲庫） -->
    <van-popup
      :show="editing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增歌曲' : '編輯歌曲' }}</h3>
        <van-field v-model="draft.title" label="歌名" maxlength="80" placeholder="例：美好的創造" />
        <van-field v-model="draft.dance_url" label="連結1（有動作）" type="url"
          placeholder="https://youtube.com/…" />
        <van-field v-model="draft.youtube_url" label="連結2（純歌詞）" type="url"
          placeholder="https://youtube.com/…" />
        <van-field v-model="draft.lyrics" label="歌詞" type="textarea" rows="4" autosize
          maxlength="3000" placeholder="貼上歌詞（選填）" />
        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
          儲存
        </van-button>
        <van-button v-if="editing !== 'new'" round block plain type="danger" class="del-btn" @click="remove">
          刪除
        </van-button>
      </div>
    </van-popup>

    <!-- 歌單期間編輯 -->
    <van-popup
      :show="plEditing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (plEditing = null)"
    >
      <div class="editor">
        <h3>{{ activeGroupName }}歌單</h3>
        <van-field v-model="plDraft.title" label="名稱" maxlength="40" placeholder="例：2026年7-8月" />
        <van-field v-model="plDraft.start_date" label="開始日" placeholder="2026-07-01" />
        <van-field v-model="plDraft.end_date" label="結束日" placeholder="2026-08-31" />
        <p class="hint pl-hint">勾選曲目（點選順序＝歌單順序）：</p>
        <div class="pl-songs">
          <van-tag
            v-for="s in songs"
            :key="s.id"
            round
            size="large"
            :type="plSongIds.includes(s.id) ? 'primary' : 'default'"
            :plain="!plSongIds.includes(s.id)"
            @click="togglePlSong(s.id)"
          >
            {{ plSongIds.includes(s.id) ? `${plSongIds.indexOf(s.id) + 1}. ` : '' }}{{ s.title }}
          </van-tag>
        </div>
        <template v-if="plSongIds.length > 0">
          <p class="hint pl-hint">本週歌曲（可複選，會置頂顯示）：</p>
          <div class="pl-songs">
            <van-tag
              v-for="sid in plSongIds"
              :key="'wk' + sid"
              round
              size="large"
              :type="plWeeklyIds.includes(sid) ? 'warning' : 'default'"
              :plain="!plWeeklyIds.includes(sid)"
              @click="togglePlWeekly(sid)"
            >
              {{ plWeeklyIds.includes(sid) ? '★ ' : '' }}{{ songById.get(sid)?.title ?? '' }}
            </van-tag>
          </div>
        </template>
        <van-button round block type="primary" :loading="plSaving" class="save-btn" @click="savePl">
          儲存歌單
        </van-button>
        <van-button v-if="plEditing !== 'new'" round block plain type="danger" class="del-btn" @click="removePl">
          刪除歌單
        </van-button>
      </div>
    </van-popup>

    <!-- 熟悉度編輯 -->
    <van-popup
      :show="famEditing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (famEditing = null)"
    >
      <div class="editor" v-if="famEditing">
        <h3>{{ famEditing.title }} · {{ activeGroupName }}熟悉度</h3>
        <p class="hint center">1＝不熟、5＝熟悉（班級整體練習進度）</p>
        <div v-for="dim in (['song_level', 'motion_level'] as const)" :key="dim" class="fam-dim">
          <span class="fam-label">{{ dim === 'song_level' ? '歌唱' : '動作' }}</span>
          <van-tag
            v-for="v in FAMILIARITY_VALUES"
            :key="v"
            round
            size="large"
            :type="famDraft[dim] === v ? 'primary' : 'default'"
            :plain="famDraft[dim] !== v"
            @click="setFam(dim, v)"
          >
            {{ v }}
          </van-tag>
        </div>
        <van-button round block type="primary" :loading="famSaving" class="save-btn" @click="saveFam">
          儲存
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
/* 外觀比照 Vant small plain button，但實體是連結（v9 #6） */
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}
.link-btn.dance {
  color: var(--van-warning-color, #ff976a);
}
.link-btn.lyric {
  color: var(--van-danger-color, #ee0a24);
}
.link-btn:active {
  opacity: 0.7;
}
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 10px;
}
.section-row .section-title {
  margin: 16px 0 10px;
}
/* 窄螢幕（iPhone SE）：按鈕不被左側標題/說明擠壓變形 */
.section-row .van-button {
  flex-shrink: 0;
}
.tabs {
  margin: 10px 0 4px;
}
.song-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--kll-primary-soft);
  color: var(--kll-primary);
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.title {
  flex: 1;
  font-size: 21px;
}
.song-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.fam-line {
  margin: 10px 0 0;
}
.weekly-card {
  border: 2px solid var(--kll-amber);
}
.weekly-tag {
  flex-shrink: 0;
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
.center {
  text-align: center;
  margin-bottom: 10px;
}
.pl-hint {
  margin: 12px 16px 8px;
}
.pl-songs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 16px;
}
/* 窄螢幕（iPhone SE）：長歌名允許在標籤內換行，不溢出畫面 */
.pl-songs :deep(.van-tag) {
  max-width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: 32px;
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
  padding-top: 4px;
  padding-bottom: 4px;
}
.fam-dim {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 10px;
}
.fam-label {
  width: 40px;
  color: var(--kll-sub);
  font-size: 15px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
