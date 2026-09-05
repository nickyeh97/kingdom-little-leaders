<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { updateDisplayName } from '../api/members'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

/** 版本號來自 package.json（vite define 注入），不必兩處手動同步 */
const appVersion = __APP_VERSION__

// ---- 顯示稱呼（v7 #1：使用者可自行設定）----
const editingName = ref(false)
const nameDraft = ref('')
const savingName = ref(false)

function openNameEditor() {
  nameDraft.value = auth.profile?.display_name ?? ''
  editingName.value = true
}

async function saveName() {
  const name = nameDraft.value.trim()
  const id = auth.profile?.id
  if (!id) return
  if (!name) {
    showFailToast('請填寫稱呼')
    return
  }
  savingName.value = true
  try {
    await updateDisplayName(id, name)
    await auth.loadProfile()
    showSuccessToast('已更新稱呼')
    editingName.value = false
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    savingName.value = false
  }
}

async function logout() {
  try {
    await showConfirmDialog({ title: '登出', message: '確定要登出嗎？' })
  } catch {
    return // 使用者按取消
  }
  await auth.signOut()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <h2>我的</h2>
    <div class="card center">
      <div class="avatar" />
      <strong>{{ auth.profile?.display_name }}</strong>
      <p class="hint">{{ auth.session?.user.email }}</p>
      <van-button size="small" plain type="primary" class="name-btn" @click="openNameEditor">
        ✎ 修改稱呼
      </van-button>
    </div>
    <h3 class="section-title" style="--sec: var(--kll-primary)">關於兒童牧區</h3>
    <van-cell-group inset>
      <van-cell
        title="國度領袖兒童異象"
        label="培育神國小領袖，活出天父美好的計畫"
        is-link
        @click="$router.push({ name: 'vision' })"
      />
      <van-cell
        v-if="auth.isApproved"
        title="組織架構與分工"
        label="兒童牧區團隊組別、職務，與孩子班上的老師"
        is-link
        @click="$router.push({ name: 'org' })"
      />
      <van-cell
        v-if="auth.isApproved"
        title="兒童服事項目"
        label="孩子可以參與的服事與說明"
        is-link
        @click="$router.push({ name: 'child-service-items' })"
      />
    </van-cell-group>
    <h3 v-if="auth.can('parent')" class="section-title" style="--sec: var(--kll-pink)">
      我的孩子
    </h3>
    <van-cell-group inset v-if="auth.can('parent')">
      <van-cell
        title="孩子上過的課程"
        label="最近 4 次主日，孩子班上教了什麼"
        is-link
        @click="$router.push({ name: 'my-lessons' })"
      />
    </van-cell-group>
    <h3 v-if="auth.can('admin')" class="section-title" style="--sec: var(--kll-orange)">管理</h3>
    <van-cell-group inset v-if="auth.can('admin')">
      <van-cell
        title="名單與權限"
        label="成員角色標籤、孩子與家庭綁定"
        is-link
        @click="$router.push({ name: 'members' })"
      />
    </van-cell-group>
    <h3 v-if="auth.can('teacher') || auth.can('admin')" class="section-title" style="--sec: var(--kll-green)">
      老師與同工
    </h3>
    <van-cell-group inset v-if="auth.can('teacher') || auth.can('admin')">
      <van-cell
        title="教案"
        label="每班每聚會日；段落分區塊共編"
        is-link
        @click="$router.push({ name: 'lesson-plans' })"
      />
      <van-cell
        title="聚會流程與運作要點"
        label="各班標準流程與班務規則"
        is-link
        @click="$router.push({ name: 'class-info' })"
      />
      <van-cell
        title="教材資料庫"
        label="外連教會 NAS / 雲端的教材目錄"
        is-link
        @click="$router.push({ name: 'materials' })"
      />
      <van-cell
        title="開會決議"
        label="大會/同工/班別會議紀錄與待辦追蹤"
        is-link
        @click="$router.push({ name: 'meetings' })"
      />
      <van-cell
        title="出席紀錄（近半年）"
        label="可匯出 CSV 存 NAS / Google Sheet"
        is-link
        @click="$router.push({ name: 'records' })"
      />
      <van-cell
        title="課堂紀錄（本年）"
        label="課後反饋與交接＋詩歌熟悉度"
        is-link
        @click="$router.push({ name: 'class-log' })"
      />
    </van-cell-group>
    <van-cell-group inset>
      <van-cell title="版本" :value="appVersion" />
      <van-cell title="登出" is-link @click="logout" />
    </van-cell-group>

    <!-- 修改稱呼（v7 #1） -->
    <van-popup
      :show="editingName"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => (editingName = v)"
    >
      <div class="editor">
        <h3>修改稱呼</h3>
        <p class="hint name-hint">
          這是平台上顯示給其他人看的名字，請直接填您的名字
        </p>
        <van-field v-model="nameDraft" label="稱呼" maxlength="20" placeholder="請填您的名字" />
        <van-button round block type="primary" :loading="savingName" class="save-btn" @click="saveName">
          儲存
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 25px;
}
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 16px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--kll-primary-soft);
}
.name-btn {
  margin-top: 10px;
}
.editor {
  padding: 20px 16px 28px;
}
.editor h3 {
  margin: 0 0 8px;
  text-align: center;
  font-size: 22px;
}
.name-hint {
  margin: 0 16px 12px;
}
.save-btn {
  margin-top: 14px;
}
</style>
