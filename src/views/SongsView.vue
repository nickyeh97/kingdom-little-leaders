<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { createSong, deleteSong, listSongs, updateSong } from '../api/songs'
import { formatGathering, upcomingGathering } from '../lib/gathering'
import { useAuthStore } from '../stores/auth'
import type { Song } from '../types'

const auth = useAuthStore()
const gathering = upcomingGathering()
const songs = ref<Song[]>([])
const loading = ref(true)
const openLyrics = ref<string[]>([])

async function load() {
  loading.value = true
  try {
    songs.value = await listSongs(gathering)
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openYoutube(song: Song) {
  if (song.youtube_url) window.open(song.youtube_url, '_blank')
}

// ---- 管理端：新增/編輯/刪除 ----
const editing = ref<Song | 'new' | null>(null)
const draft = ref({ title: '', youtube_url: '', lyrics: '' })
const saving = ref(false)

function openEditor(s: Song | null) {
  if (!auth.can('admin')) return
  editing.value = s ?? 'new'
  draft.value = s
    ? { title: s.title, youtube_url: s.youtube_url ?? '', lyrics: s.lyrics ?? '' }
    : { title: '', youtube_url: '', lyrics: '' }
}

async function save() {
  if (!draft.value.title.trim()) {
    showFailToast('請填寫歌名')
    return
  }
  saving.value = true
  try {
    const input = {
      gathering_date: gathering,
      title: draft.value.title.trim(),
      youtube_url: draft.value.youtube_url.trim() || null,
      lyrics: draft.value.lyrics.trim() || null,
      sort_order: editing.value === 'new' ? songs.value.length : (editing.value as Song).sort_order,
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
</script>

<template>
  <div class="page">
    <div class="section-row">
      <div>
        <h2>本週敬拜詩歌</h2>
        <p class="hint">{{ formatGathering(gathering) }} · 和孩子一起預習吧 🎵</p>
      </div>
      <van-button v-if="auth.can('admin')" size="small" type="primary" plain @click="openEditor(null)">
        ＋新增
      </van-button>
    </div>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div v-if="songs.length === 0" class="card hint">本週歌單尚未發布</div>
      <div v-for="(s, i) in songs" :key="s.id" class="card">
        <div class="song-head">
          <span class="num">{{ i + 1 }}</span>
          <strong class="title">{{ s.title }}</strong>
          <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(s)">編輯</van-button>
        </div>
        <div class="song-actions">
          <van-button
            v-if="s.youtube_url"
            size="small"
            type="danger"
            plain
            icon="play-circle-o"
            @click="openYoutube(s)"
          >
            YouTube
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
        <p v-if="openLyrics.includes(s.id)" class="lyrics">{{ s.lyrics }}</p>
      </div>
    </template>

    <van-popup
      :show="editing !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增歌曲' : '編輯歌曲' }}</h3>
        <p class="hint center">歌單週次：{{ gathering }}</p>
        <van-field v-model="draft.title" label="歌名" maxlength="80" placeholder="例：耶穌喜愛小孩" />
        <van-field v-model="draft.youtube_url" label="YouTube" type="url"
          placeholder="https://youtube.com/…（純歌詞版佳）" />
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
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 4px;
  font-size: 18px;
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
.num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--kll-primary-soft);
  color: var(--kll-primary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.title {
  flex: 1;
  font-size: 15px;
}
.song-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.lyrics {
  margin: 10px 0 0;
  padding: 10px 12px;
  background: var(--kll-bg);
  border-radius: 10px;
  font-size: 13px;
  white-space: pre-wrap;
  color: var(--kll-text);
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 4px;
  text-align: center;
  font-size: 16px;
}
.center {
  text-align: center;
  margin-bottom: 10px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
