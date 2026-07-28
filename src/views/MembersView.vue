<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listProfiles, updateRoles } from '../api/members'
import type { Profile, UserRole } from '../types'

const members = ref<Profile[]>([])
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

onMounted(async () => {
  try {
    members.value = await listProfiles()
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

// ---- 角色標籤編輯 ----
const editing = ref<Profile | null>(null)
const draftRoles = ref<UserRole[]>([])
const saving = ref(false)

function openEditor(m: Profile) {
  editing.value = m
  draftRoles.value = [...m.roles]
}

async function save() {
  const target = editing.value
  if (!target) return
  if (draftRoles.value.length === 0) {
    showFailToast('至少需保留一個角色')
    return
  }
  saving.value = true
  try {
    await updateRoles(target.id, draftRoles.value)
    target.roles = [...draftRoles.value]
    showSuccessToast('已更新角色')
    editing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h2>名單與權限</h2>
    <van-search v-model="keyword" placeholder="搜尋姓名⋯" />
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

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-for="m in filtered" :key="m.id" class="card row" @click="openEditor(m)">
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
        點選成員可編輯角色標籤；一人可同時具備多個角色（例如組長＝管理者＋老師＋家長）。
        家長僅能看到自己綁定的孩子；權限規則由資料庫層（RLS）強制執行。
      </p>
    </template>

    <van-popup
      :show="editing !== null"
      round
      position="bottom"
      @update:show="(v: boolean) => !v && (editing = null)"
    >
      <div class="editor" v-if="editing">
        <h3>編輯「{{ editing.display_name }}」的角色標籤</h3>
        <van-checkbox-group v-model="draftRoles">
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
                <van-checkbox :name="r" @click.stop />
              </template>
            </van-cell>
          </van-cell-group>
        </van-checkbox-group>
        <p class="hint editor-hint">擁有標籤即開通對應功能；管理者可使用全部功能</p>
        <van-button round block type="primary" :loading="saving" @click="save">儲存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.filters {
  display: flex;
  gap: 8px;
  margin: 8px 0 14px;
  flex-wrap: wrap;
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
.editor-hint {
  text-align: center;
  margin: 10px 0 14px;
}
</style>
