<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import { deleteProfile, listProfiles, updateApproved, updateRoles } from '../api/members'
import { listAllChildren } from '../api/records'
import {
  addChildPermission,
  listChildPermissions,
  listChildServiceItems,
  removeChildPermission,
} from '../api/childService'
import { childServiceItemOptions } from '../lib/service'
import { classTagStyle } from '../lib/classColor'
import { useAuthStore } from '../stores/auth'
import {
  createChild,
  deleteChild,
  listFamilyLinks,
  listTeacherClassAssignments,
  setChildParents,
  setTeacherClasses,
  updateChild,
  type FamilyLink,
  type TeacherClassAssignment,
} from '../api/roster'
import type {
  Child,
  ChildServiceItem,
  ChildServicePermission,
  ClassGroup,
  Profile,
  UserRole,
} from '../types'

const auth = useAuthStore()
const members = ref<Profile[]>([])
const children = ref<Child[]>([])
const links = ref<FamilyLink[]>([])
const classGroups = ref<ClassGroup[]>([])
const assignments = ref<TeacherClassAssignment[]>([])
const keyword = ref('')
const filter = ref<'all' | UserRole | 'children' | 'pending'>('all')
const loading = ref(true)

const pendingCount = computed(() => members.value.filter((m) => !m.approved).length)

const roleLabel: Record<UserRole, string> = {
  admin: '管理者',
  teacher: '老師',
  parent: '家長',
}
const allRoles: UserRole[] = ['admin', 'teacher', 'parent']

/** Figma 05：全部 / 家長 n / 老師 n / 管理者 n / 孩子 n 篩選膠囊（＋待審核） */
const pills = computed(() => {
  const items: { key: typeof filter.value; label: string }[] = [
    { key: 'all', label: `全部 ${members.value.length}` },
    { key: 'parent', label: `家長 ${members.value.filter((m) => m.roles.includes('parent')).length}` },
    { key: 'teacher', label: `老師 ${members.value.filter((m) => m.roles.includes('teacher')).length}` },
    { key: 'admin', label: `管理者 ${members.value.filter((m) => m.roles.includes('admin')).length}` },
    { key: 'children', label: `孩子 ${children.value.length}` },
  ]
  if (pendingCount.value > 0) items.splice(1, 0, { key: 'pending', label: `待審核 ${pendingCount.value}` })
  return items
})

const filteredMembers = computed(() =>
  members.value.filter(
    (m) =>
      (filter.value === 'all' ||
        (filter.value === 'pending' ? !m.approved : m.roles.includes(filter.value as UserRole))) &&
      (keyword.value === '' || m.display_name.includes(keyword.value)),
  ),
)

const filteredChildren = computed(() =>
  children.value.filter((c) => keyword.value === '' || c.name.includes(keyword.value)),
)

const parentMembers = computed(() => members.value.filter((m) => m.roles.includes('parent')))

function parentsOf(childId: string): Profile[] {
  const ids = new Set(links.value.filter((l) => l.child_id === childId).map((l) => l.parent_id))
  return members.value.filter((m) => ids.has(m.id))
}

/** 成員列副標：家長顯示綁定孩子（Figma 樣式），其餘顯示加入日期 */
function memberDetail(m: Profile): string {
  if (m.roles.includes('parent')) {
    const kids = children.value.filter((c) =>
      links.value.some((l) => l.parent_id === m.id && l.child_id === c.id),
    )
    if (kids.length)
      return `綁定：${kids.map((k) => `${k.name}（${k.class_groups?.name?.slice(0, 2) ?? ''}）`).join('、')}`
    return '尚未綁定孩子'
  }
  return `${new Date(m.created_at).toLocaleDateString('zh-TW')} 加入`
}

onMounted(async () => {
  try {
    ;[
      members.value,
      children.value,
      links.value,
      classGroups.value,
      assignments.value,
      childPerms.value,
      serviceItems.value,
    ] = await Promise.all([
      listProfiles(),
      listAllChildren(),
      listFamilyLinks(),
      listClassGroups(),
      listTeacherClassAssignments(),
      listChildPermissions(),
      listChildServiceItems(),
    ])
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

/** 老師標籤班別化：老師的角色標籤顯示為「＊＊班老師」 */
function classesOf(teacherId: string): ClassGroup[] {
  const ids = new Set(
    assignments.value.filter((a) => a.teacher_id === teacherId).map((a) => a.class_group_id),
  )
  return classGroups.value.filter((g) => ids.has(g.id))
}

function roleTags(m: Profile): { label: string; type: 'warning' | 'primary' | 'success' }[] {
  const tags: { label: string; type: 'warning' | 'primary' | 'success' }[] = []
  if (m.roles.includes('admin')) tags.push({ label: '管理者', type: 'warning' })
  if (m.roles.includes('teacher')) {
    const cls = classesOf(m.id)
    if (cls.length === 0) tags.push({ label: '老師（未指派）', type: 'primary' })
    else for (const g of cls) tags.push({ label: `${g.name}老師`, type: 'primary' })
  }
  if (m.roles.includes('parent')) tags.push({ label: '家長', type: 'success' })
  return tags
}

// ---- 邀請成員（開放註冊後：分享網址 → 對方自行註冊 → 回此頁設定角色） ----
const showInvite = ref(false)
const appUrl = window.location.origin

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(appUrl)
    showSuccessToast('已複製連結')
  } catch {
    showFailToast('複製失敗，請手動複製')
  }
}

// ---- 成員角色編輯（含老師班別指派） ----
const editingMember = ref<Profile | null>(null)
const draftRoles = ref<UserRole[]>([])
const draftClasses = ref<string[]>([])
const savingMember = ref(false)

function openMemberEditor(m: Profile) {
  editingMember.value = m
  draftRoles.value = [...m.roles]
  draftClasses.value = classesOf(m.id).map((g) => g.id)
}

function toggleRole(r: UserRole) {
  draftRoles.value = draftRoles.value.includes(r)
    ? draftRoles.value.filter((x) => x !== r)
    : [...draftRoles.value, r]
}

function toggleClass(id: string) {
  draftClasses.value = draftClasses.value.includes(id)
    ? draftClasses.value.filter((x) => x !== id)
    : [...draftClasses.value, id]
}

async function saveMember() {
  const target = editingMember.value
  if (!target) return
  if (draftRoles.value.length === 0) {
    showFailToast('至少需保留一個角色')
    return
  }
  if (draftRoles.value.includes('teacher') && draftClasses.value.length === 0) {
    showFailToast('老師需至少指派一個班別')
    return
  }
  savingMember.value = true
  try {
    await updateRoles(target.id, draftRoles.value)
    await setTeacherClasses(
      target.id,
      draftRoles.value.includes('teacher') ? draftClasses.value : [],
    )
    target.roles = [...draftRoles.value]
    assignments.value = [
      ...assignments.value.filter((a) => a.teacher_id !== target.id),
      ...(draftRoles.value.includes('teacher')
        ? draftClasses.value.map((class_group_id) => ({ teacher_id: target.id, class_group_id }))
        : []),
    ]
    showSuccessToast('已更新角色')
    editingMember.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingMember.value = false
  }
}

/** 核准或取消核准（未審核者僅能看公告與帳號設定） */
async function setApproved(approved: boolean) {
  const target = editingMember.value
  if (!target) return
  try {
    await updateApproved(target.id, approved)
    target.approved = approved
    showSuccessToast(approved ? '已核准加入' : '已取消核准')
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

async function removeMember() {
  const target = editingMember.value
  if (!target) return
  try {
    await showConfirmDialog({
      title: '刪除成員',
      message: `確定刪除「${target.display_name}」？其家庭綁定將一併移除；對方將無法再使用平台功能。`,
    })
  } catch {
    return
  }
  try {
    await deleteProfile(target.id)
    members.value = members.value.filter((m) => m.id !== target.id)
    links.value = links.value.filter((l) => l.parent_id !== target.id)
    showSuccessToast('已刪除成員')
    editingMember.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

// ---- 孩子編輯（含家庭綁定） ----
const editingChild = ref<Child | 'new' | null>(null)
const childDraft = ref({
  name: '',
  class_group_id: '',
  parentIds: [] as string[],
})
const savingChild = ref(false)

function openChildEditor(c: Child | null) {
  editingChild.value = c ?? 'new'
  childDraft.value = c
    ? {
        name: c.name,
        class_group_id: String(c.class_group_id),
        parentIds: parentsOf(c.id).map((p) => p.id),
      }
    : {
        name: '',
        class_group_id: classGroups.value[0]?.id ?? '',
        parentIds: [],
      }
}

// ---- 服事項目授權（v5 #3：孩子×項目；即點即存，該班老師或同工）----
const childPerms = ref<ChildServicePermission[]>([])
/** 兒童服事項目字典（v11 #4）：勾選按鈕的來源 */
const serviceItems = ref<ChildServiceItem[]>([])
const permSaving = ref(false)

function permsOf(childId: string): ChildServicePermission[] {
  return childPerms.value.filter((p) => p.child_id === childId)
}
function permItemOptions(childId: string): string[] {
  const granted = permsOf(childId).map((p) => p.item)
  return childServiceItemOptions(serviceItems.value, granted)
}
function hasPerm(childId: string, item: string): boolean {
  return permsOf(childId).some((p) => p.item === item)
}
async function togglePerm(childId: string, item: string) {
  if (permSaving.value) return
  permSaving.value = true
  const existing = permsOf(childId).find((p) => p.item === item)
  try {
    if (existing) {
      await removeChildPermission(existing.id)
      childPerms.value = childPerms.value.filter((p) => p.id !== existing.id)
    } else {
      await addChildPermission(childId, item, auth.profile?.display_name ?? '')
      childPerms.value = await listChildPermissions()
    }
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    permSaving.value = false
  }
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
    <!-- Figma 05：標題＋邀請成員 -->
    <header class="head">
      <h2>名單與權限</h2>
      <van-button size="small" type="primary" @click="showInvite = true">＋ 邀請成員</van-button>
    </header>

    <van-search v-model="keyword" placeholder="搜尋姓名⋯" shape="round" />

    <!-- 篩選改 card 頁籤（比照服事頁）：PC/手機都好點（使用者回饋 2026-08-21） -->
    <van-tabs
      :active="filter"
      type="card"
      class="filter-tabs"
      @update:active="(v: string | number) => (filter = v as typeof filter)"
    >
      <van-tab v-for="p in pills" :key="p.key" :name="p.key" :title="p.label" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="6" />

    <!-- 成員列表 -->
    <template v-else-if="filter !== 'children'">
      <div v-for="m in filteredMembers" :key="m.id" class="card row" @click="openMemberEditor(m)">
        <div class="avatar" />
        <div class="info">
          <strong>{{ m.display_name }}</strong>
          <span class="hint detail">{{ memberDetail(m) }}</span>
          <div class="tags">
            <van-tag v-if="!m.approved" type="danger" plain round>待審核</van-tag>
            <van-tag
              v-for="t in roleTags(m)"
              :key="t.label"
              :type="t.type"
              round
              :class="{ dim: !m.approved }"
            >
              {{ t.label }}
            </van-tag>
          </div>
        </div>
        <span class="more">⋯</span>
      </div>
      <div v-if="filteredMembers.length === 0" class="card hint">沒有符合的成員</div>
    </template>

    <!-- 孩子列表 -->
    <template v-else>
      <van-button round block type="primary" plain class="add-btn" @click="openChildEditor(null)">
        ＋新增孩子
      </van-button>
      <div v-for="c in filteredChildren" :key="c.id" class="card row" @click="openChildEditor(c)">
        <div class="avatar child-avatar" />
        <div class="info">
          <strong>{{ c.name }}</strong>
          <span class="hint detail">
            {{ parentsOf(c.id).length
              ? `綁定：${parentsOf(c.id).map((p) => p.display_name).join('、')}`
              : '尚未綁定家長' }}
          </span>
        </div>
        <van-tag :style="classTagStyle(c.class_groups?.name)">{{ c.class_groups?.name ?? '' }}</van-tag>
        <span class="more">⋯</span>
      </div>
      <div v-if="filteredChildren.length === 0" class="card hint">沒有符合的孩子</div>
    </template>

    <p class="hint foot-note">
      家長僅能看到自己綁定的孩子；權限規則由資料庫層（RLS）強制執行。
    </p>

    <!-- 邀請成員 -->
    <van-popup :show="showInvite" round closeable position="bottom" @update:show="(v: boolean) => (showInvite = v)">
      <div class="editor">
        <h3>邀請成員</h3>
        <p class="invite-desc">
          把平台連結傳給對方（LINE、訊息皆可），對方以 Email 或 Google
          <strong>註冊</strong>後，預設為<strong>家長</strong>身分；再回到本頁點選該成員開通老師/管理者標籤、並到「孩子」頁籤綁定孩子。
        </p>
        <div class="link-box">{{ appUrl }}</div>
        <van-button round block type="primary" @click="copyInviteLink">複製連結</van-button>
      </div>
    </van-popup>

    <!-- 成員角色編輯 -->
    <van-popup
      :show="editingMember !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (editingMember = null)"
    >
      <div class="editor" v-if="editingMember">
        <h3>編輯「{{ editingMember.display_name }}」</h3>

        <van-button
          v-if="!editingMember.approved"
          round
          block
          type="success"
          class="approve-btn"
          @click="setApproved(true)"
        >
          ✓ 核准加入（開通角色功能）
        </van-button>

        <van-cell-group inset>
          <van-cell
            v-for="r in allRoles"
            :key="r"
            clickable
            :title="roleLabel[r]"
            @click="toggleRole(r)"
          >
            <template #right-icon>
              <van-checkbox :model-value="draftRoles.includes(r)" @click.stop="toggleRole(r)" />
            </template>
          </van-cell>
        </van-cell-group>
        <template v-if="draftRoles.includes('teacher')">
          <p class="hint bind-title">老師班別指派（點名/日誌僅限被指派的班別）</p>
          <van-cell-group inset>
            <van-cell
              v-for="g in classGroups"
              :key="g.id"
              clickable
              :title="`${g.name}老師`"
              @click="toggleClass(g.id)"
            >
              <template #right-icon>
                <van-checkbox
                  :model-value="draftClasses.includes(g.id)"
                  @click.stop="toggleClass(g.id)"
                />
              </template>
            </van-cell>
          </van-cell-group>
        </template>
        <p class="hint center">擁有標籤即開通對應功能（嚴格逐標籤授權）；未審核者僅能看公告</p>
        <van-button round block type="primary" :loading="savingMember" @click="saveMember">
          儲存
        </van-button>
        <van-button
          v-if="editingMember.approved"
          round
          block
          plain
          class="del-btn"
          @click="setApproved(false)"
        >
          取消核准（暫停使用）
        </van-button>
        <van-button round block plain type="danger" class="del-btn" @click="removeMember">
          刪除成員
        </van-button>
      </div>
    </van-popup>

    <!-- 孩子編輯 -->
    <van-popup
      :show="editingChild !== null"
      round
      closeable
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
        <template v-if="editingChild !== 'new'">
          <p class="hint bind-title">
            服事項目授權（點選開通/取消，即點即存；家長端只看到已開通項目）
          </p>
          <div class="perm-row">
            <van-tag
              v-for="it in permItemOptions((editingChild as Child).id)"
              :key="it"
              round
              size="large"
              :type="hasPerm((editingChild as Child).id, it) ? 'primary' : 'default'"
              :plain="!hasPerm((editingChild as Child).id, it)"
              @click="togglePerm((editingChild as Child).id, it)"
            >
              {{ hasPerm((editingChild as Child).id, it) ? '✓ ' : '' }}{{ it }}
            </van-tag>
          </div>
          <!-- v6 #6a：項目固定六項，自訂新增暫時隱藏（既有自訂授權仍顯示於上方可取消） -->
        </template>
        <p v-else class="hint bind-title">服事項目授權：儲存孩子資料後即可設定</p>
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
              <van-checkbox
                :model-value="childDraft.parentIds.includes(p.id)"
                @click.stop="toggleParent(p.id)"
              />
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
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.head h2 {
  margin: 0;
  font-size: 25px;
}
.filter-tabs {
  margin: 8px 0 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--kll-line);
  flex-shrink: 0;
}
.child-avatar {
  background: var(--kll-primary-soft);
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.more {
  color: var(--kll-sub);
  font-weight: 700;
  flex-shrink: 0;
}
.add-btn {
  margin: 0 0 14px;
}
.foot-note {
  margin-top: 14px;
}
.editor {
  padding: 20px 16px 28px;
  user-select: none; /* 快速點擊勾選時避免反白選字 */
}
.editor h3 {
  margin: 0 0 12px;
  font-size: 22px;
  text-align: center;
}
.invite-desc {
  font-size: 18px;
  color: var(--kll-sub);
  line-height: 1.7;
  margin: 0 0 14px;
}
.link-box {
  background: var(--kll-bg);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 17px;
  word-break: break-all;
  margin-bottom: 14px;
  text-align: center;
}
.center {
  text-align: center;
  margin: 10px 0 14px;
}
.tag-opt {
  margin: 0;
}
/* 窄螢幕（iPhone SE）：cell 內的選項標籤允許換行，避免溢出 */
.editor :deep(.van-cell__value) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.bind-title {
  margin: 12px 16px 6px;
}
.perm-row {
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
.approve-btn {
  margin-bottom: 14px;
}
.dim {
  opacity: 0.45;
}
</style>
