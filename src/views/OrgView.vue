<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import {
  createOrgUnit,
  deleteOrgUnit,
  listOrgUnits,
  updateOrgUnit,
} from '../api/meetings'
import { useAuthStore } from '../stores/auth'
import type { OrgUnit } from '../types'

const auth = useAuthStore()
const units = ref<OrgUnit[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    units.value = await listOrgUnits()
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const editing = ref<OrgUnit | 'new' | null>(null)
const draft = ref({ title: '', members_text: '', note: '' })
const saving = ref(false)

function openEditor(u: OrgUnit | null) {
  if (!auth.can('admin')) return
  editing.value = u ?? 'new'
  draft.value = u
    ? { title: u.title, members_text: u.members_text, note: u.note }
    : { title: '', members_text: '', note: '' }
}

async function save() {
  if (!draft.value.title.trim()) {
    showFailToast('請填寫組別/職務名稱')
    return
  }
  saving.value = true
  try {
    if (editing.value === 'new') {
      await createOrgUnit({
        ...draft.value,
        title: draft.value.title.trim(),
        sort_order: (units.value[units.value.length - 1]?.sort_order ?? -1) + 1,
      })
    } else if (editing.value) {
      await updateOrgUnit(editing.value.id, { ...draft.value, title: draft.value.title.trim() })
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
    await deleteOrgUnit(target.id)
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
        <h2>組織架構與分工</h2>
        <p class="hint">兒主團隊組別、職務與名單（同工維護）</p>
      </div>
      <van-button v-if="auth.can('admin')" size="small" type="primary" plain @click="openEditor(null)">
        ＋新增
      </van-button>
    </div>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div v-if="units.length === 0" class="card hint">尚未建立組織架構</div>
      <div
        v-for="u in units"
        :key="u.id"
        class="card"
        :class="{ clickable: auth.can('admin') }"
        @click="openEditor(u)"
      >
        <strong class="unit-title">{{ u.title }}</strong>
        <p v-if="u.members_text" class="unit-members">👥 {{ u.members_text }}</p>
        <p v-if="u.note" class="hint unit-note">{{ u.note }}</p>
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
        <h3>{{ editing === 'new' ? '新增組別/職務' : '編輯' }}</h3>
        <van-field v-model="draft.title" label="名稱" maxlength="40"
          placeholder="例：兒主窗口、敬拜組" />
        <van-field v-model="draft.members_text" label="名單" type="textarea" rows="2" autosize
          maxlength="500" placeholder="成員姓名（頓號分隔）" />
        <van-field v-model="draft.note" label="說明" type="textarea" rows="2" autosize
          maxlength="500" placeholder="職責說明（選填）" />
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
  margin-bottom: 12px;
}
.clickable {
  cursor: pointer;
}
.unit-title {
  font-size: 21px;
}
.unit-members {
  margin: 8px 0 0;
  font-size: 17px;
}
.unit-note {
  margin: 6px 0 0;
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
