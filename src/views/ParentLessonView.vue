<script setup lang="ts">
/**
 * 孩子上過的課程（家長版簡易教案，v10 #2）。
 *
 * 只查閱、不編輯；只回看最近 4 次聚會；只顯示「項目／內容／帶班老師」＋當期詩歌。
 * 授權與欄位過濾都在資料庫層（parent_lesson_segments RPC）完成，
 * 前端的判斷只是 UX——家長就算改前端也拿不到教材預備、課後執行或別班的教案。
 *
 * 幼幼班無教案模組（v4 決議 8），RPC 已排除；只有幼幼班孩子的家長會看到說明文字。
 */
import { computed, onMounted, ref } from 'vue'
import { showFailToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import { listParentLessonSegments } from '../api/teaching'
import { listSongs, listWeeklySongs, type WeeklySongRow } from '../api/songs'
import { formatGathering, recentGatherings } from '../lib/gathering'
import { classTagStyle } from '../lib/classColor'
import { normalizeUrl } from '../lib/url'
import { PARENT_LESSON_COUNT, groupParentLessons, songsForDate } from '../lib/parentLesson'
import type { ClassGroup, ParentLessonSegment, Song } from '../types'

const dates = recentGatherings(PARENT_LESSON_COUNT)
const segments = ref<ParentLessonSegment[]>([])
const groups = ref<ClassGroup[]>([])
const weekly = ref<WeeklySongRow[]>([])
const songs = ref<Song[]>([])
const loading = ref(true)

const days = computed(() => groupParentLessons(segments.value))

function className(id: string): string {
  return groups.value.find((g) => g.id === id)?.name ?? ''
}

onMounted(async () => {
  try {
    const [segs, gs, ss] = await Promise.all([
      listParentLessonSegments(dates[0], dates[dates.length - 1]),
      listClassGroups(),
      listSongs(),
    ])
    segments.value = segs
    groups.value = gs
    songs.value = ss
    // 那天唱的歌：逐班取近 4 次聚會的排定歌曲（家長通常只有 1–2 個班別）
    const classIds = [...new Set(segs.map((x) => x.class_group_id))]
    const rows = await Promise.all(
      classIds.map((id) => listWeeklySongs(id, dates[0], dates[dates.length - 1])),
    )
    weekly.value = rows.flat()
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <h2>孩子上過的課程</h2>
    <p class="hint">最近 {{ PARENT_LESSON_COUNT }} 次主日，孩子班上教了什麼</p>

    <van-loading v-if="loading" class="loading" />

    <template v-else>
      <div v-for="day in days" :key="`${day.gathering_date}-${day.class_group_id}`" class="card">
        <div class="day-head">
          <strong>{{ formatGathering(day.gathering_date) }}</strong>
          <van-tag :style="classTagStyle(className(day.class_group_id))">
            {{ className(day.class_group_id) }}
          </van-tag>
        </div>
        <p v-if="day.teachers.length" class="teachers">帶班老師：{{ day.teachers.join('、') }}</p>

        <div v-for="(seg, i) in day.segments" :key="i" class="seg">
          <div class="seg-item">{{ seg.item }}</div>
          <p class="seg-content">{{ seg.content }}</p>
        </div>

        <div
          v-if="songsForDate(weekly, songs, day.class_group_id, day.gathering_date).length"
          class="songs"
        >
          <div class="songs-title">🎵 這次唱的詩歌</div>
          <p
            v-for="song in songsForDate(weekly, songs, day.class_group_id, day.gathering_date)"
            :key="song.id"
            class="song"
          >
            <span>{{ song.title }}</span>
            <a
              v-if="normalizeUrl(song.dance_url)"
              :href="normalizeUrl(song.dance_url)"
              target="_blank"
              rel="noopener"
            >
              有動作
            </a>
            <a
              v-if="normalizeUrl(song.youtube_url)"
              :href="normalizeUrl(song.youtube_url)"
              target="_blank"
              rel="noopener"
            >
              純歌詞
            </a>
          </p>
        </div>
      </div>

      <p v-if="days.length === 0" class="card hint">
        最近 {{ PARENT_LESSON_COUNT }} 次主日還沒有可查閱的課程內容。<br />
        幼幼班以點名與老師課後紀錄為主，沒有教案；其他班別的教案由老師課後整理，稍後再回來看看。
      </p>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.loading {
  text-align: center;
  padding: 24px 0;
}
.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.teachers {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--kll-sub);
}
.seg {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--kll-line);
}
.seg-item {
  font-weight: 600;
  font-size: 16px;
}
.seg-content {
  margin: 4px 0 0;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.songs {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--kll-line);
}
.songs-title {
  font-size: 14px;
  color: var(--kll-sub);
}
.song {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 0;
  font-size: 15px;
}
.song a {
  font-size: 13px;
  color: var(--kll-primary);
}
</style>
