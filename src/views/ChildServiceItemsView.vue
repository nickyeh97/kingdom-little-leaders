<script setup lang="ts">
/**
 * 兒童服事項目（v11 #4）。
 *
 * 同工維護「名稱＋說明」，改動會同步到**逐項授權（名單頁）**與**報名勾選（服事頁）**的按鈕；
 * **所有已審核的成員都看得到**（不限兒童班家長）——讓孩子與家長看得懂每個服事在做什麼，
 * 老師與同工也常需要對著這份說明跟家長解釋。編輯權則只給同工（RLS 亦同）。
 *
 * ⚠️ 名稱同時是既有授權/報名/排班紀錄的 `item` 文字：改名不會自動搬移舊紀錄，
 *    所以改名前會先提醒。要下架某項目請用「停用」而不是刪除。
 *
 * 守則檢核：這頁描述的是「可以參與什麼服事」，不呈現誰做得好不好、不排名（紅燈 #1）。
 */
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import {
  createChildServiceItem,
  deleteChildServiceItem,
  listChildServiceItems,
  updateChildServiceItem,
} from '../api/childService'
import { useAuthStore } from '../stores/auth'
import type { ChildServiceItem } from '../types'

const auth = useAuthStore()
const items = ref<ChildServiceItem[]>([])
const loading = ref(true)
const canEdit = computed(() => auth.can('admin'))

const editing = ref<ChildServiceItem | 'new' | null>(null)
const draft = ref({ name: '', description: '', sort_order: 0, active: true })
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    items.value = await listChildServiceItems()
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openEditor(item: ChildServiceItem | null) {
  if (!canEdit.value) return
  if (item) {
    editing.value = item
    draft.value = {
      name: item.name,
      description: item.description,
      sort_order: item.sort_order,
      active: item.active,
    }
  } else {
    editing.value = 'new'
    draft.value = {
      name: '',
      description: '',
      sort_order: (items.value[items.value.length - 1]?.sort_order ?? 0) + 1,
      active: true,
    }
  }
}

async function save() {
  const name = draft.value.name.trim()
  if (!name) {
    showFailToast('請填寫項目名稱')
    return
  }
  const target = editing.value
  // 改名不會搬移既有授權/報名紀錄（那些以文字比對），先講清楚再存
  if (target !== 'new' && target && target.name !== name) {
    try {
      await showConfirmDialog({
        title: '確認改名',
        message: `「${target.name}」→「${name}」。\n既有的授權與報名紀錄仍記在舊名稱下，不會一起改。確定要改嗎？`,
      })
    } catch {
      return
    }
  }
  saving.value = true
  try {
    const input = {
      name,
      description: draft.value.description.trim(),
      sort_order: draft.value.sort_order,
      active: draft.value.active,
    }
    if (target === 'new') await createChildServiceItem(input)
    else if (target) await updateChildServiceItem(target.id, input)
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
    await showConfirmDialog({
      title: '刪除項目',
      message: `確定刪除「${target.name}」？既有紀錄不會被刪，但這個項目會從所有勾選按鈕消失。\n若只是暫時不用，建議改為「停用」。`,
    })
  } catch {
    return
  }
  try {
    await deleteChildServiceItem(target.id)
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
    <h2>兒童服事項目</h2>
    <p class="hint">
      孩子可以參與的服事與說明{{ canEdit ? '；改動會同步到授權與報名的勾選按鈕' : '' }}
    </p>

    <div v-if="canEdit" class="add-row">
      <van-button size="small" type="primary" plain @click="openEditor(null)">＋ 新增項目</van-button>
    </div>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div v-if="items.length === 0" class="card hint">尚未建立服事項目</div>
      <div
        v-for="it in items"
        :key="it.id"
        class="card"
        :class="{ off: !it.active }"
        @click="openEditor(it)"
      >
        <div class="item-head">
          <strong class="name">{{ it.name }}</strong>
          <van-tag v-if="!it.active" type="default" plain>已停用</van-tag>
          <van-button v-if="canEdit" size="mini" plain @click.stop="openEditor(it)">編輯</van-button>
        </div>
        <p v-if="it.description" class="desc">{{ it.description }}</p>
        <p v-else class="hint">（尚未填寫說明）</p>
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
        <h3>{{ editing === 'new' ? '新增服事項目' : '編輯服事項目' }}</h3>
        <van-field
          v-model="draft.name"
          label="名稱"
          label-align="top"
          maxlength="30"
          placeholder="例：收奉獻"
        />
        <van-field
          v-model="draft.description"
          label="說明"
          label-align="top"
          type="textarea"
          rows="3"
          autosize
          maxlength="300"
          placeholder="這個服事在做什麼、需要注意什麼（孩子與家長看得到）"
        />
        <van-field
          v-model.number="draft.sort_order"
          label="排序"
          label-align="top"
          type="digit"
          placeholder="數字小的排前面"
        />
        <van-cell title="啟用" center>
          <template #right-icon>
            <van-switch v-model="draft.active" size="24" />
          </template>
        </van-cell>
        <p class="hint">停用＝不再出現在新的勾選按鈕，既有授權與報名紀錄不受影響。</p>

        <van-button round block type="primary" :loading="saving" class="save-btn" @click="save">
          儲存
        </van-button>
        <van-button
          v-if="editing !== 'new'"
          round
          block
          plain
          type="danger"
          class="del-btn"
          @click="remove"
        >
          刪除項目
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
.add-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  flex: 1;
  font-size: 19px;
}
.desc {
  margin: 8px 0 0;
  font-size: 16px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.card.off {
  opacity: 0.6;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 12px;
  text-align: center;
}
.save-btn {
  margin-top: 16px;
}
.del-btn {
  margin-top: 10px;
}
</style>
