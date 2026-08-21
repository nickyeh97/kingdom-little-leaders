<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createClassDoc,
  deleteClassDoc,
  listClassDocs,
  updateClassDoc,
} from '../api/teaching'
import { FLOW_TEMPLATE, GUIDE_TEMPLATE } from '../lib/classInfo'
import { classHasIndex } from '../lib/performance'
import { useAuthStore } from '../stores/auth'
import type { ClassDoc, ClassGroup } from '../types'

const auth = useAuthStore()
const groups = ref<ClassGroup[]>([])
const activeGroup = ref('')
const docs = ref<ClassDoc[]>([])
const loading = ref(true)

const flows = computed(() => docs.value.filter((d) => d.kind === 'flow'))
const guides = computed(() => docs.value.filter((d) => d.kind === 'guide'))

async function load() {
  if (!activeGroup.value) return
  loading.value = true
  try {
    docs.value = await listClassDocs(activeGroup.value)
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    groups.value = (await listClassGroups()).filter((g) => classHasIndex(g.name))
    activeGroup.value = groups.value[0]?.id ?? ''
    if (!activeGroup.value) loading.value = false
  } catch (e) {
    showFailToast((e as Error).message)
    loading.value = false
  }
})

watch(activeGroup, load)

/** 一鍵以標準流程建立（範本源自共編 Excel 兒童班流程；時長依教案範本回推） */
const creatingTemplate = ref(false)
async function createFromTemplate() {
  if (creatingTemplate.value) return
  creatingTemplate.value = true
  try {
    let order = 0
    for (const t of FLOW_TEMPLATE) {
      await createClassDoc({
        class_group_id: activeGroup.value,
        kind: 'flow',
        ...t,
        sort_order: order++,
      })
    }
    order = 0
    for (const t of GUIDE_TEMPLATE) {
      await createClassDoc({
        class_group_id: activeGroup.value,
        kind: 'guide',
        ...t,
        sort_order: order++,
      })
    }
    await load()
    showSuccessToast('已建立標準流程，點各項目即可修改')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    creatingTemplate.value = false
  }
}

// ---- 同工編輯 ----
const editing = ref<ClassDoc | 'new' | null>(null)
const draft = ref<{ kind: 'flow' | 'guide'; title: string; content: string; extra: string }>({
  kind: 'flow',
  title: '',
  content: '',
  extra: '',
})
const saving = ref(false)

function openEditor(doc: ClassDoc | null, kind: 'flow' | 'guide' = 'flow') {
  if (!auth.can('admin')) return
  editing.value = doc ?? 'new'
  draft.value = doc
    ? { kind: doc.kind, title: doc.title, content: doc.content, extra: doc.extra }
    : { kind, title: '', content: '', extra: kind === 'flow' ? '必做' : '' }
}

async function save() {
  if (!draft.value.title.trim()) {
    showFailToast('請填寫主題')
    return
  }
  saving.value = true
  try {
    if (editing.value === 'new') {
      const siblings = docs.value.filter((d) => d.kind === draft.value.kind)
      await createClassDoc({
        class_group_id: activeGroup.value,
        ...draft.value,
        title: draft.value.title.trim(),
        sort_order: (siblings[siblings.length - 1]?.sort_order ?? -1) + 1,
      })
    } else if (editing.value) {
      await updateClassDoc(editing.value.id, { ...draft.value, title: draft.value.title.trim() })
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
    await showConfirmDialog({ title: '刪除', message: `確定刪除「${target.title}」？` })
  } catch {
    return
  }
  try {
    await deleteClassDoc(target.id)
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
    <h2>聚會流程與運作要點</h2>
    <p class="hint">各班標準流程與常態性班務規則（同工維護；老師檢視）</p>

    <van-tabs v-model:active="activeGroup" type="card" class="tabs">
      <van-tab v-for="g in groups" :key="g.id" :name="g.id" :title="g.name" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <!-- 空白班別：一鍵套用標準流程（老師寫教案的依據） -->
      <div v-if="flows.length === 0 && guides.length === 0 && auth.can('admin')" class="card empty">
        <p class="empty-title">這個班別還沒有聚會流程</p>
        <p class="hint">範本取自現行共編（兒童班流程），含必做/選做與建議時長，建立後可逐項修改</p>
        <van-button
          round
          block
          type="primary"
          :loading="creatingTemplate"
          class="tpl-btn"
          @click="createFromTemplate"
        >
          ⚡ 以標準流程建立（{{ FLOW_TEMPLATE.length }} 項流程＋{{ GUIDE_TEMPLATE.length }} 項要點）
        </van-button>
      </div>

      <div class="sec-row">
        <h3 class="section-title">聚會流程</h3>
        <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(null, 'flow')">
          ＋新增
        </van-button>
      </div>
      <div v-if="flows.length === 0" class="card hint">尚未建立流程</div>
      <div
        v-for="d in flows"
        :key="d.id"
        class="card"
        :class="{ clickable: auth.can('admin') }"
        @click="openEditor(d)"
      >
        <div class="doc-head">
          <strong>{{ d.title }}</strong>
          <van-tag v-if="d.extra" :type="d.extra.includes('選做') || d.extra === '彈性' ? 'warning' : 'primary'" plain>
            {{ d.extra }}
          </van-tag>
        </div>
        <p v-if="d.content" class="doc-body">{{ d.content }}</p>
      </div>

      <div class="sec-row">
        <h3 class="section-title">運作詳細要點</h3>
        <van-button v-if="auth.can('admin')" size="mini" plain @click="openEditor(null, 'guide')">
          ＋新增
        </van-button>
      </div>
      <div v-if="guides.length === 0" class="card hint">尚未建立要點</div>
      <div
        v-for="d in guides"
        :key="d.id"
        class="card"
        :class="{ clickable: auth.can('admin') }"
        @click="openEditor(d)"
      >
        <div class="doc-head">
          <strong>{{ d.title }}</strong>
          <van-tag v-if="d.extra" plain>{{ d.extra }}</van-tag>
        </div>
        <p v-if="d.content" class="doc-body">{{ d.content }}</p>
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
        <h3>{{ editing === 'new' ? '新增' : '編輯' }}{{ draft.kind === 'flow' ? '流程' : '要點' }}</h3>
        <van-field v-model="draft.title" label="主題" maxlength="60"
          placeholder="例：預告/倒數計時、班級公約" />
        <van-field v-model="draft.content" label="內容" type="textarea" rows="4" autosize
          maxlength="2000" placeholder="詳細說明" />
        <van-field
          v-model="draft.extra"
          :label="draft.kind === 'flow' ? '方式' : '備註'"
          maxlength="30"
          :placeholder="draft.kind === 'flow' ? '例：必做・約10分鐘 / 選做' : '選填'"
        />
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
.tabs {
  margin: 12px 0;
}
.sec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
  margin-top: 14px;
}
.clickable {
  cursor: pointer;
}
.doc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.doc-head strong {
  font-size: 20px;
}
.doc-body {
  margin: 8px 0 0;
  font-size: 17px;
  color: var(--kll-text);
  white-space: pre-wrap;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 12px;
  text-align: center;
  font-size: 22px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
