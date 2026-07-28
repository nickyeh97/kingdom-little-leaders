<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import { listProfiles, updateRoles } from '../api/members'
import { listAllChildren } from '../api/records'
import {
  createChild,
  deleteChild,
  listFamilyLinks,
  setChildParents,
  updateChild,
  type FamilyLink,
} from '../api/roster'
import type { Child, ClassGroup, Profile, UserRole } from '../types'

const activeTab = ref<'members' | 'children'>('members')
const members = ref<Profile[]>([])
const children = ref<Child[]>([])
const links = ref<FamilyLink[]>([])
const classGroups = ref<ClassGroup[]>([])
const keyword = ref('')
const filterRole = ref<'all' | UserRole>('all')
const loading = ref(true)

const roleLabel: Record<UserRole, string> = {
  admin: '管理者',
  teacher: '老師',
  parent: '家長',
}
const roleTagType: Record<UserRole, 'warning' | 'primary' | 'success'> = {
  admin: 'warning',
  teacher: 'primary',
  parent: 'success',
}
const allRoles: UserRole[] = ['admin', 'teacher', 'parent']

const filtered = computed(() =>
  members.value.filter(
    (m) =>
      (filterRole.value === 'all' || m.roles.includes(filterRole.value)) &&
      (keyword.value === '' || m.display_name.includes(keyword.value)),
  ),
)

/** 具家長標籤的成員（供綁定選擇） */
const parentMembers = computed(() => members.value.filter((m) => m.roles.includes('parent')))

function parentsOf(childId: string): Profile[] {
  const ids = new Set(links.value.filter((l) => l.child_id === childId).map((l) => l.parent_id))
  return members.value.filter((m) => ids.has(m.id))
}

const filteredChildren = computed(() =>
  children.value.filter((c) => keyword.value === '' || c.name.includes(keyword.value)),
)

onMounted(async () => {
  try {
    ;[members.value, children.value, links.value, classGroups.value] = await Promise.all([
      listProfiles(),
      listAllChildren(),
      listFamilyLinks(),
      listClassGroups(),
    ])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

// ---- 成員角色編輯 ----
const editingMember = ref<Profile | null>(null)
const draftRoles = ref<UserRole[]>([])
const savingMember = ref(false)

function openMemberEditor(m: Profile) {
  editingMember.value = m
  draftRoles.value = [...m.roles]
}

async function saveMember() {
  const target = editingMember.value
  if (!target) return
  if (draftRoles.value.length === 0) {
    showFailToast('至少需保留一個角色')
    return
  }
  savingMember.value = true
  try {
    await updateRoles(target.id, draftRoles.value)
    target.roles = [...draftRoles.value]
    showSuccessToast('已更新角色')
    editingMember.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingMember.value = false
  }
}

// ---- 孩子編輯（含家庭綁定） ----
const editingChild = ref<Child | 'new' | null>(null)
const childDraft = ref({ name: '', class_group_id: '', parentIds: [] as string[] })
const savingChild = ref(false)

function openChildEditor(c: Child | null) {
  editingChild.value = c ?? 'new'
  childDraft.value = c
    ? {
        name: c.name,
        class_group_id: String(c.class_group_id),
        parentIds: parentsOf(c.id).map((p) => p.id),
      }
    : { name: '', class_group_id: classGroups.value[0]?.id ?? '', parentIds: [] }
}

function toggleParent(id: string) {
  childDraft.value.parentIds = childDraft.value.parentIds.includes(id)
    ? childDraft.value.parentIds.filter((x) => x !== id)
    : [...childDraft.value.parentIds, id]
}

async function saveChild() {
  if (!childDraft.value.name.trim()) {
    showFailToast('請填寫姓名')
    return
  }
  savingChild.value = true
  try {
    let childId: string
    const base = {
      name: childDraft.value.name.trim(),
      class_group_id: childDraft.value.class_group_id,
    }
    if (editingChild.value === 'new') {
      const created = await createChild(base)
      childId = created.id
    } else {
      childId = (editingChild.value as Child).id
      await updateChild(childId, base)
    }
    await setChildParents(childId, childDraft.value.parentIds)
    ;[children.value, links.value] = await Promise.all([listAllChildren(), listFamilyLinks()])
    showSuccessToast('已儲存')
    editingChild.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingChild.value = false
  }
}

async function removeChild() {
  const target = editingChild.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({
      title: '刪除孩子資料',
      message: `確定刪除「${target.name}」？出席與課堂紀錄將一併刪除，無法復原。`,
    })
  } catch {
    return
  }
  try {
    await deleteChild(target.id)
    ;[children.value, links.value] = await Promise.all([listAllChildren(), listFamilyLinks()])
    showSuccessToast('已刪除')
    editingChild.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <h2>名單與權限</h2>
    <van-tabs v-model:active="activeTab" class="tabs">
      <van-tab title="成員" name="members" />
      <van-tab :title="`孩子 ${children.length}`" name="children" />
    </van-tabs>
    <van-search v-model="keyword" placeholder="搜尋姓名⋯" />

    <van-skeleton v-if="loading" title :row="5" />

    <!-- 成員 -->
    <template v-else-if="activeTab === 'members'">
      <div class="filters">
        <van-tag
          v-for="f in (['all', ...allRoles] as const)"
          :key="f"
          round
          size="large"
          :type="filterRole === f ? 'primary' : 'default'"
          :plain="filterRole !== f"
          @click="filterRole = f"
        >
          {{ f === 'all' ? `全部 ${members.length}` : roleLabel[f] }}
        </van-tag>
      </div>
      <div v-for="m in filtered" :key="m.id" class="card row" @click="openMemberEditor(m)">
        <div class="info">
          <strong>{{ m.display_name }}</strong>
          <span class="hint">{{ new Date(m.created_at).toLocaleDateString('zh-TW') }} 加入</span>
        </div>
        <div class="tags">
          <van-tag v-for="r in m.roles" :key="r" :type="roleTagType[r]" round>
            {{ roleLabel[r] }}
          </van-tag>
        </div>
      </div>
      <p class="hint">
        點選成員可編輯角色標籤（組長＝管理者＋老師＋家長）。新帳號目前仍於 Supabase
        後台建立，站內邀請流程規劃中。
      </p>
    </template>

    <!-- 孩子與綁定 -->
    <template v-else>
      <van-button round block type="primary" plain class="add-btn" @click="openChildEditor(null)">
        ＋新增孩子
      </van-button>
      <div v-for="c in filteredChildren" :key="c.id" class="card row" @click="openChildEditor(c)">
        <div class="info">
          <strong>{{ c.name }}</strong>
          <span class="hint">
            {{ parentsOf(c.id).length
              ? `綁定：${parentsOf(c.id).map((p) => p.display_name).join('、')}`
              : '尚未綁定家長' }}
          </span>
        </div>
        <van-tag plain type="primary">{{ c.class_groups?.name ?? '' }}</van-tag>
      </div>
      <p class="hint">點選孩子可修改姓名、班別與家長綁定；一位孩子可綁定多位家長。</p>
    </template>

    <!-- 成員角色編輯 -->
    <van-popup
      :show="editingMember !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editingMember = null)"
    >
      <div class="editor" v-if="editingMember">
        <h3>編輯「{{ editingMember.display_name }}」的角色標籤</h3>
        <van-cell-group inset>
          <van-cell
            v-for="r in allRoles"
            :key="r"
            clickable
            :title="roleLabel[r]"
            @click="
              draftRoles.includes(r)
                ? (draftRoles = draftRoles.filter((x) => x !== r))
                : draftRoles.push(r)
            "
          >
            <template #right-icon>
              <van-checkbox :model-value="draftRoles.includes(r)" @click.stop />
            </template>
          </van-cell>
        </van-cell-group>
        <p class="hint center">擁有標籤即開通對應功能（嚴格逐標籤授權）</p>
        <van-button round block type="primary" :loading="savingMember" @click="saveMember">
          儲存
        </van-button>
      </div>
    </van-popup>

    <!-- 孩子編輯 -->
    <van-popup
      :show="editingChild !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editingChild = null)"
    >
      <div class="editor" v-if="editingChild">
        <h3>{{ editingChild === 'new' ? '新增孩子' : `編輯「${(editingChild as Child).name}」` }}</h3>
        <van-field v-model="childDraft.name" label="姓名" maxlength="30" placeholder="孩子姓名" />
        <van-cell title="班別" center>
          <template #value>
            <van-tag
              v-for="g in classGroups"
              :key="g.id"
              round
              size="large"
              class="tag-opt"
              :type="childDraft.class_group_id === g.id ? 'primary' : 'default'"
              :plain="childDraft.class_group_id !== g.id"
              @click="childDraft.class_group_id = g.id"
            >
              {{ g.name }}
            </van-tag>
          </template>
        </van-cell>
        <p class="hint bind-title">綁定家長（可多選）</p>
        <van-cell-group inset>
          <van-cell
            v-for="p in parentMembers"
            :key="p.id"
            clickable
            :title="p.display_name"
            @click="toggleParent(p.id)"
          >
            <template #right-icon>
              <van-checkbox :model-value="childDraft.parentIds.includes(p.id)" @click.stop />
            </template>
          </van-cell>
          <van-cell v-if="parentMembers.length === 0" title="尚無具家長標籤的成員" />
        </van-cell-group>
        <van-button round block type="primary" :loading="savingChild" class="save-btn" @click="saveChild">
          儲存
        </van-button>
        <van-button
          v-if="editingChild !== 'new'"
          round
          block
          plain
          type="danger"
          class="del-btn"
          @click="removeChild"
        >
          刪除孩子資料
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.tabs {
  margin-bottom: 4px;
}
.filters {
  display: flex;
  gap: 8px;
  margin: 8px 0 14px;
  flex-wrap: wrap;
}
.add-btn {
  margin: 8px 0 14px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 12px;
  font-size: 16px;
  text-align: center;
}
.center {
  text-align: center;
  margin: 10px 0 14px;
}
.tag-opt {
  margin-left: 8px;
}
.bind-title {
  margin: 12px 16px 6px;
}
.save-btn {
  margin-top: 14px;
}
.del-btn {
  margin-top: 8px;
}
</style>
