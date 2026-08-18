<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createLessonSegment,
  deleteLessonSegment,
  listLessonSegments,
  updateLessonSegment,
} from '../api/teaching'
import {
  formatGathering,
  recentGatherings,
  upcomingGathering,
  upcomingGatherings,
} from '../lib/gathering'
import { classHasIndex } from '../lib/performance'
import { LESSON_ITEM_PRESETS } from '../lib/teaching'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, LessonSegment } from '../types'

const auth = useAuthStore()
/** 近 3 次＋未來 3 次聚會日（去重、由舊到新） */
const dates = [...new Set([...recentGatherings(3), ...upcomingGatherings(3)])]
const selectedDate = ref(upcomingGathering())

const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const segments = ref<LessonSegment[]>([])
const loading = ref(true)

/** 可否編輯目前班別（該班老師或同工；分區塊共編以列為單位） */
const canEdit = computed(
  () => auth.can('admin') || auth.canClass(activeGroup.value),
)

async function load() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    segments.value = await listLessonSegments(activeGroup.value, selectedDate.value)
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

// ---- 段落編輯（分區塊：一列一存）----
const editing = ref<LessonSegment | 'new' | null>(null)
const draft = ref({
  time_text: '',
  item: '',
  content: '',
  teacher_text: '',
  materials_text: '',
  review_text: '',
})
const saving = ref(false)

function openEditor(seg: LessonSegment | null) {
  if (!canEdit.value) return
  editing.value = seg ?? 'new'
  draft.value = seg
    ? {
        time_text: seg.time_text,
        item: seg.item,
        content: seg.content,
        teacher_text: seg.teacher_text,
        materials_text: seg.materials_text,
        review_text: seg.review_text,
      }
    : {
        time_text: '',
        item: '',
        content: '',
        teacher_text: auth.profile?.display_name ?? '',
        materials_text: '',
        review_text: '',
      }
}

async function save() {
  if (!draft.value.item.trim() && !draft.value.content.trim()) {
    showFailToast('請至少填寫項目或內容')
    return
  }
  saving.value = true
  try {
    const base = {
      ...draft.value,
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
    await showConfirmDialog({ title: '刪除段落', message: `確定刪除「${target.item || '此段落'}」？` })
  } catch {
    return
  }
  try {
    await deleteLessonSegment(target.id)
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
    await load()
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <h2>教案</h2>
    <p class="hint">每班每聚會日一份；各段落獨立編輯（主題課程/彈性時間可由不同老師分別填寫）</p>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
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
    <p class="hint sel-date">{{ formatGathering(selectedDate) }}</p>

    <van-button
      v-if="canEdit"
      round
      block
      plain
      type="primary"
      class="add-btn"
      @click="openEditor(null)"
    >
      ＋新增段落
    </van-button>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="segments.length === 0" class="card hint">本日尚無教案內容</div>
      <div v-for="(seg, i) in segments" :key="seg.id" class="card">
        <div class="seg-head">
          <van-tag type="primary" plain>{{ seg.item || '未命名' }}</van-tag>
          <span class="hint">{{ seg.time_text }}</span>
          <span v-if="seg.teacher_text" class="hint">👤 {{ seg.teacher_text }}</span>
          <span class="spacer" />
          <template v-if="canEdit">
            <button class="mv" :disabled="i === 0" @click="move(seg, -1)">↑</button>
            <button class="mv" :disabled="i === segments.length - 1" @click="move(seg, 1)">↓</button>
            <van-button size="mini" plain @click="openEditor(seg)">編輯</van-button>
          </template>
        </div>
        <p v-if="seg.content" class="seg-line">{{ seg.content }}</p>
        <p v-if="seg.materials_text" class="seg-line dim">🧰 教材預備：{{ seg.materials_text }}</p>
        <p v-if="seg.review_text" class="seg-line review">📝 課後執行記錄:{{ seg.review_text }}</p>
        <p v-if="seg.updated_by_name" class="hint upd">
          {{ seg.updated_by_name }} 更新於 {{ seg.updated_at.slice(0, 10) }}
        </p>
      </div>
      <p v-if="!canEdit && segments.length > 0" class="hint">
        ※ 僅該班老師與同工可編輯；您目前為唯讀檢視。
      </p>
    </template>

    <van-popup
      :show="editing !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增段落' : '編輯段落' }}</h3>
        <van-field v-model="draft.time_text" label="時間" maxlength="40"
          placeholder="例：5分鐘 1400-1405" />
        <p class="hint pop-label">項目（可自行輸入）</p>
        <div class="tag-row">
          <van-tag
            v-for="it in LESSON_ITEM_PRESETS"
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
        <van-field v-model="draft.item" label="項目" maxlength="40" placeholder="或自行輸入" />
        <van-field v-model="draft.content" label="內容" type="textarea" rows="3" autosize
          maxlength="2000" placeholder="教學內容、流程說明、YouTube 連結…" />
        <van-field v-model="draft.teacher_text" label="老師" maxlength="60"
          placeholder="此段落負責老師" />
        <van-field v-model="draft.materials_text" label="教材預備" type="textarea" rows="1" autosize
          maxlength="500" placeholder="教材預備／備註" />
        <van-field v-model="draft.review_text" label="課後執行" type="textarea" rows="1" autosize
          maxlength="500" placeholder="課後執行記錄（改善&建議，課後補填）" />
        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
          儲存此段落
        </van-button>
        <van-button v-if="editing !== 'new'" round block plain type="danger" class="del-btn" @click="remove">
          刪除段落
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
.date-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.sel-date {
  margin: 6px 0 10px;
}
.add-btn {
  margin-bottom: 12px;
}
.seg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.mv {
  width: 34px;
  height: 32px;
  border: 1px solid var(--kll-border, #dde4df);
  border-radius: 8px;
  background: var(--kll-bg);
  font-size: 16px;
}
.mv:disabled {
  opacity: 0.35;
}
.seg-line {
  margin: 8px 0 0;
  font-size: 18px;
  white-space: pre-wrap;
}
.dim {
  color: var(--kll-sub);
  font-size: 16px;
}
.review {
  background: var(--kll-amber-soft);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 16px;
}
.upd {
  margin: 8px 0 0;
  font-size: 13px;
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
  margin: 10px 16px 6px;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 16px 8px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
