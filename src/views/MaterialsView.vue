<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from '../api/teaching'
import { classHasIndex } from '../lib/performance'
import { MATERIAL_CATEGORY_PRESETS } from '../lib/teaching'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, Material } from '../types'

const auth = useAuthStore()
const groups = ref<ClassGroup[]>([])
/** 頁籤：共用 ＋ 各班（不含幼幼） */
const activeTab = ref('shared')
const materials = ref<Material[]>([])
const loading = ref(true)

const tabItems = computed(() => [
  { id: 'shared', name: '共用' },
  ...groups.value.map((g) => ({ id: g.id, name: g.name })),
])

const shown = computed(() =>
  materials.value.filter((m) =>
    activeTab.value === 'shared'
      ? m.class_group_id === null
      : String(m.class_group_id) === activeTab.value,
  ),
)
/** 依目錄分組 */
const byCategory = computed(() => {
  const map = new Map<string, Material[]>()
  for (const m of shown.value) {
    const list = map.get(m.category) ?? []
    list.push(m)
    map.set(m.category, list)
  }
  return map
})

async function load() {
  loading.value = true
  try {
    ;[materials.value, groups.value] = await Promise.all([
      listMaterials(),
      listClassGroups().then((gs) => gs.filter((g) => classHasIndex(g.name))),
    ])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openUrl(url: string) {
  window.open(url, '_blank')
}
function canEdit(m: Material): boolean {
  return auth.can('admin') || m.created_by === auth.session?.user.id
}

// ---- 新增/編輯（老師可自由上傳共用——外連型）----
const editing = ref<Material | 'new' | null>(null)
const draft = ref({ class_group_id: null as string | null, category: '', title: '', url: '', note: '' })
const saving = ref(false)

function openEditor(m: Material | null) {
  editing.value = m ?? 'new'
  draft.value = m
    ? {
        class_group_id: m.class_group_id,
        category: m.category,
        title: m.title,
        url: m.url,
        note: m.note,
      }
    : {
        class_group_id: activeTab.value === 'shared' ? null : activeTab.value,
        category: '',
        title: '',
        url: '',
        note: '',
      }
}

async function save() {
  if (!draft.value.title.trim() || !draft.value.url.trim()) {
    showFailToast('請填寫名稱與連結')
    return
  }
  saving.value = true
  try {
    const input = {
      ...draft.value,
      title: draft.value.title.trim(),
      url: draft.value.url.trim(),
      category: draft.value.category.trim() || '未分類',
      note: draft.value.note.trim(),
      created_by_name: auth.profile?.display_name ?? '',
    }
    if (editing.value === 'new') await createMaterial(input)
    else if (editing.value) await updateMaterial(editing.value.id, input)
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
    await showConfirmDialog({ title: '刪除教材', message: `確定刪除「${target.title}」？（僅移除連結，雲端檔案不受影響）` })
  } catch {
    return
  }
  try {
    await deleteMaterial(target.id)
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
    <div class="head-row">
      <div>
        <h2>教材資料庫</h2>
        <p class="hint">外連型：檔案放教會 NAS/雲端，這裡存目錄與連結</p>
      </div>
      <van-button size="small" type="primary" plain @click="openEditor(null)">＋新增</van-button>
    </div>

    <van-tabs v-model:active="activeTab" type="card" class="tabs">
      <van-tab v-for="t in tabItems" :key="t.id" :name="t.id" :title="t.name" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="shown.length === 0" class="card hint">此分類尚無教材，點右上「＋新增」貼上連結</div>
      <template v-for="[cat, items] in byCategory" :key="cat">
        <h3 class="section-title">{{ cat }}</h3>
        <div v-for="m in items" :key="m.id" class="card">
          <div class="mat-head">
            <strong class="mat-title" @click="openUrl(m.url)">🔗 {{ m.title }}</strong>
            <van-button v-if="canEdit(m)" size="mini" plain @click="openEditor(m)">編輯</van-button>
          </div>
          <p v-if="m.note" class="mat-note">{{ m.note }}</p>
          <p class="hint mat-meta">{{ m.created_by_name }} · {{ m.created_at.slice(0, 10) }}</p>
        </div>
      </template>
    </template>

    <van-popup
      :show="editing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor">
        <h3>{{ editing === 'new' ? '新增教材連結' : '編輯教材' }}</h3>
        <p class="hint pop-label">歸屬</p>
        <div class="tag-row">
          <van-tag
            v-for="t in tabItems"
            :key="t.id"
            round
            size="large"
            :type="(draft.class_group_id ?? 'shared') === t.id ? 'primary' : 'default'"
            :plain="(draft.class_group_id ?? 'shared') !== t.id"
            @click="draft.class_group_id = t.id === 'shared' ? null : t.id"
          >
            {{ t.name }}
          </van-tag>
        </div>
        <p class="hint pop-label">目錄（可自行輸入）</p>
        <div class="tag-row">
          <van-tag
            v-for="c in MATERIAL_CATEGORY_PRESETS"
            :key="c"
            round
            size="large"
            :type="draft.category === c ? 'primary' : 'default'"
            :plain="draft.category !== c"
            @click="draft.category = draft.category === c ? '' : c"
          >
            {{ c }}
          </van-tag>
        </div>
        <van-field v-model="draft.category" label="目錄" maxlength="30" placeholder="或自行輸入" />
        <van-field v-model="draft.title" label="名稱" maxlength="80" placeholder="教材名稱" />
        <van-field v-model="draft.url" label="連結" type="url"
          placeholder="教會雲端/NAS/YouTube 連結" />
        <van-field v-model="draft.note" label="備註" maxlength="200" placeholder="選填" />
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
.head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.tabs {
  margin: 12px 0;
}
.mat-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mat-title {
  flex: 1;
  font-size: 19px;
  color: var(--kll-primary-dark);
  cursor: pointer;
  word-break: break-all;
}
.mat-note {
  margin: 6px 0 0;
  font-size: 16px;
}
.mat-meta {
  margin: 6px 0 0;
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
