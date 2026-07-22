<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listProfiles, updateRole } from '../api/members'
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

const filtered = computed(() =>
  members.value.filter(
    (m) =>
      (filterRole.value === 'all' || m.role === filterRole.value) &&
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

const sheetFor = ref<Profile | null>(null)
const actions = (Object.keys(roleLabel) as UserRole[]).map((r) => ({
  name: `設為${roleLabel[r]}`,
  value: r,
}))

async function onSelectRole(action: { value: UserRole }) {
  const target = sheetFor.value
  sheetFor.value = null
  if (!target || target.role === action.value) return
  try {
    await updateRole(target.id, action.value)
    target.role = action.value
    showSuccessToast('已更新角色')
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <h2>名單與權限</h2>
    <van-search v-model="keyword" placeholder="搜尋姓名⋯" />
    <div class="filters">
      <van-tag
        v-for="f in (['all', 'parent', 'teacher', 'admin'] as const)"
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
      <div v-for="m in filtered" :key="m.id" class="card row" @click="sheetFor = m">
        <div class="info">
          <strong>{{ m.display_name }}</strong>
          <span class="hint">{{ new Date(m.created_at).toLocaleDateString('zh-TW') }} 加入</span>
        </div>
        <van-tag :type="roleTagType[m.role]" round>{{ roleLabel[m.role] }}</van-tag>
      </div>
      <p class="hint">
        家長僅能看到自己綁定的孩子；權限規則由資料庫層（RLS）強制執行。孩子與家庭綁定請先於
        Supabase 後台維護（介面後續提供）。
      </p>
    </template>

    <van-action-sheet
      :show="sheetFor !== null"
      :actions="actions"
      :title="sheetFor ? `變更「${sheetFor.display_name}」的角色` : ''"
      cancel-text="取消"
      @select="onSelectRole"
      @cancel="sheetFor = null"
      @update:show="(v: boolean) => !v && (sheetFor = null)"
    />
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
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
