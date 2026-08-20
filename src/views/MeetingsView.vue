<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listClassGroups } from '../api/checkin'
import {
  createMeeting,
  createMeetingItem,
  deleteMeeting,
  deleteMeetingItem,
  listMeetings,
  updateMeeting,
  updateMeetingItem,
} from '../api/meetings'
import { MEETING_STATUS, nextStatus, statusMeta } from '../lib/meeting'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, Meeting, MeetingItem } from '../types'

const auth = useAuthStore()
const meetings = ref<Meeting[]>([])
const groups = ref<ClassGroup[]>([])
const loading = ref(true)
const openIds = ref<string[]>([])

type Tab = 'all' | 'staff' | 'class'
const activeTab = ref<Tab>('all')
const tabs = computed(() => {
  const items: { name: Tab; title: string }[] = [{ name: 'all', title: '全體大會' }]
  if (auth.can('admin')) items.push({ name: 'staff', title: '核心同工' })
  if (auth.can('admin') || auth.teacherClassIds.length > 0)
    items.push({ name: 'class', title: '班別會議' })
  return items
})

const shown = computed(() => meetings.value.filter((m) => m.scope === activeTab.value))

const groupName = computed(() => new Map(groups.value.map((g) => [g.id, g.name])))
const today = new Date().toISOString().slice(0, 10)

function items(m: Meeting): MeetingItem[] {
  return (m.meeting_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
}
function openCount(m: Meeting): number {
  return items(m).filter((i) => i.status !== 'done').length
}
function isOverdue(i: MeetingItem): boolean {
  return i.status !== 'done' && !!i.due_date && i.due_date < today
}

async function load() {
  loading.value = true
  try {
    ;[meetings.value, groups.value] = await Promise.all([listMeetings(), listClassGroups()])
    if (openIds.value.length === 0 && meetings.value.length > 0)
      openIds.value = [meetings.value[0].id]
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---- 會議編輯（同工）----
const mtEditing = ref<Meeting | 'new' | null>(null)
const mtDraft = ref<{
  scope: Tab
  class_group_id: string | null
  meeting_date: string
  title: string
  minutes: string
}>({ scope: 'all', class_group_id: null, meeting_date: '', title: '', minutes: '' })
const mtSaving = ref(false)

function openMeetingEditor(m: Meeting | null) {
  if (!auth.can('admin')) return
  mtEditing.value = m ?? 'new'
  mtDraft.value = m
    ? {
        scope: m.scope,
        class_group_id: m.class_group_id,
        meeting_date: m.meeting_date,
        title: m.title,
        minutes: m.minutes,
      }
    : {
        scope: activeTab.value,
        class_group_id: activeTab.value === 'class' ? (groups.value[0]?.id ?? null) : null,
        meeting_date: today,
        title: '',
        minutes: '',
      }
}

async function saveMeeting() {
  if (!mtDraft.value.title.trim() || !mtDraft.value.meeting_date) {
    showFailToast('請填寫日期與標題')
    return
  }
  if (mtDraft.value.scope === 'class' && !mtDraft.value.class_group_id) {
    showFailToast('班別會議請選擇班別')
    return
  }
  mtSaving.value = true
  try {
    const input = {
      ...mtDraft.value,
      title: mtDraft.value.title.trim(),
      class_group_id: mtDraft.value.scope === 'class' ? mtDraft.value.class_group_id : null,
      created_by_name: auth.profile?.display_name ?? '',
    }
    if (mtEditing.value === 'new') {
      const id = await createMeeting(input)
      openIds.value = [...openIds.value, id]
    } else if (mtEditing.value) {
      await updateMeeting(mtEditing.value.id, input)
    }
    await load()
    showSuccessToast('已儲存')
    activeTab.value = mtDraft.value.scope
    mtEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    mtSaving.value = false
  }
}

async function removeMeeting() {
  const target = mtEditing.value
  if (!target || target === 'new') return
  try {
    await showConfirmDialog({
      title: '刪除會議',
      message: `確定刪除「${target.title}」？其下事項將一併刪除。`,
    })
  } catch {
    return
  }
  try {
    await deleteMeeting(target.id)
    await load()
    showSuccessToast('已刪除')
    mtEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

// ---- 事項編輯（同工）----
const itEditing = ref<{ meeting: Meeting; item: MeetingItem | null } | null>(null)
const itDraft = ref<{ content: string; assignee: string; due_date: string; status: MeetingItem['status'] }>(
  { content: '', assignee: '', due_date: '', status: 'todo' },
)
const itSaving = ref(false)

function openItemEditor(meeting: Meeting, item: MeetingItem | null) {
  if (!auth.can('admin')) return
  itEditing.value = { meeting, item }
  itDraft.value = item
    ? {
        content: item.content,
        assignee: item.assignee,
        due_date: item.due_date ?? '',
        status: item.status,
      }
    : { content: '', assignee: '', due_date: '', status: 'todo' }
}

async function saveItem() {
  const ctx = itEditing.value
  if (!ctx) return
  if (!itDraft.value.content.trim()) {
    showFailToast('請填寫事項內容')
    return
  }
  itSaving.value = true
  try {
    const base = {
      content: itDraft.value.content.trim(),
      assignee: itDraft.value.assignee.trim(),
      due_date: itDraft.value.due_date || null,
      status: itDraft.value.status,
    }
    if (ctx.item) await updateMeetingItem(ctx.item.id, base)
    else
      await createMeetingItem({
        ...base,
        meeting_id: ctx.meeting.id,
        sort_order: (items(ctx.meeting)[items(ctx.meeting).length - 1]?.sort_order ?? -1) + 1,
      })
    await load()
    showSuccessToast('已儲存')
    itEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    itSaving.value = false
  }
}

async function removeItem() {
  const ctx = itEditing.value
  if (!ctx?.item) return
  try {
    await deleteMeetingItem(ctx.item.id)
    await load()
    showSuccessToast('已刪除')
    itEditing.value = null
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

/** 點狀態標籤循環切換：待辦 → 進行中 → 已完成（同工） */
async function cycleStatus(item: MeetingItem) {
  if (!auth.can('admin')) return
  try {
    await updateMeetingItem(item.id, { status: nextStatus(item.status) })
    await load()
  } catch (e) {
    showFailToast((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2>開會決議</h2>
        <p class="hint">會議紀錄、決議事項、分工與進度追蹤</p>
      </div>
      <van-button v-if="auth.can('admin')" size="small" type="primary" plain @click="openMeetingEditor(null)">
        ＋新增會議
      </van-button>
    </div>

    <van-tabs v-model:active="activeTab" type="card" class="tabs">
      <van-tab v-for="t in tabs" :key="t.name" :name="t.name" :title="t.title" />
    </van-tabs>

    <van-skeleton v-if="loading" title :row="5" />
    <template v-else>
      <div v-if="shown.length === 0" class="card hint">此分類尚無會議紀錄</div>
      <van-collapse v-model="openIds">
        <van-collapse-item v-for="m in shown" :key="m.id" :name="m.id">
          <template #title>
            <div class="mt-title">
              <strong>{{ m.title }}</strong>
              <span class="mt-badges">
                <van-tag plain>{{ m.meeting_date }}</van-tag>
                <van-tag v-if="m.scope === 'class' && m.class_group_id" type="primary" plain>
                  {{ groupName.get(m.class_group_id) }}
                </van-tag>
                <van-tag v-if="openCount(m) > 0" type="warning">未結 {{ openCount(m) }}</van-tag>
                <van-tag v-else-if="items(m).length > 0" type="success">全部完成</van-tag>
              </span>
            </div>
          </template>

          <p v-if="m.minutes" class="minutes">{{ m.minutes }}</p>

          <p class="blk-title">
            事項追蹤
            <van-button
              v-if="auth.can('admin')"
              size="mini"
              plain
              class="blk-btn"
              @click="openItemEditor(m, null)"
            >
              ＋事項
            </van-button>
          </p>
          <div v-if="items(m).length === 0" class="hint">尚無事項</div>
          <div v-for="it in items(m)" :key="it.id" class="item-row">
            <van-tag
              :type="statusMeta(it.status).tagType"
              class="st-tag"
              @click="cycleStatus(it)"
            >
              {{ statusMeta(it.status).label }}
            </van-tag>
            <div class="item-main" @click="openItemEditor(m, it)">
              <p class="item-content" :class="{ done: it.status === 'done' }">{{ it.content }}</p>
              <p class="hint item-meta">
                <span v-if="it.assignee">👤 {{ it.assignee }}</span>
                <span v-if="it.due_date" :class="{ overdue: isOverdue(it) }">
                  ⏰ {{ it.due_date }}{{ isOverdue(it) ? '（逾期）' : '' }}
                </span>
              </p>
            </div>
          </div>

          <p class="hint mt-meta">
            {{ m.created_by_name }} 建立
            <van-button
              v-if="auth.can('admin')"
              size="mini"
              plain
              class="blk-btn"
              @click="openMeetingEditor(m)"
            >
              編輯會議
            </van-button>
          </p>
        </van-collapse-item>
      </van-collapse>
      <p v-if="auth.can('admin') && shown.length" class="hint foot-tip">
        點狀態標籤可切換 待辦 → 進行中 → 已完成；點事項內容可編輯分工與期限。
      </p>
    </template>

    <!-- 會議編輯 -->
    <van-popup
      :show="mtEditing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (mtEditing = null)"
    >
      <div class="editor">
        <h3>{{ mtEditing === 'new' ? '新增會議' : '編輯會議' }}</h3>
        <p class="hint pop-label">類型</p>
        <div class="tag-row">
          <van-tag
            v-for="t in [
              { v: 'all', label: '全體大會' },
              { v: 'staff', label: '核心同工' },
              { v: 'class', label: '班別會議' },
            ]"
            :key="t.v"
            round
            size="large"
            :type="mtDraft.scope === t.v ? 'primary' : 'default'"
            :plain="mtDraft.scope !== t.v"
            @click="mtDraft.scope = t.v as 'all' | 'staff' | 'class'"
          >
            {{ t.label }}
          </van-tag>
        </div>
        <div v-if="mtDraft.scope === 'class'" class="tag-row">
          <van-tag
            v-for="g in groups"
            :key="g.id"
            round
            size="large"
            :type="mtDraft.class_group_id === g.id ? 'primary' : 'default'"
            :plain="mtDraft.class_group_id !== g.id"
            @click="mtDraft.class_group_id = g.id"
          >
            {{ g.name }}
          </van-tag>
        </div>
        <van-field v-model="mtDraft.meeting_date" label="日期" placeholder="2026-08-22" />
        <van-field v-model="mtDraft.title" label="標題" maxlength="60"
          placeholder="例：8月同工月會" />
        <van-field v-model="mtDraft.minutes" label="會議紀錄" type="textarea" rows="4" autosize
          maxlength="5000" placeholder="討論內容與結論" />
        <van-button round block type="primary" :loading="mtSaving" class="save-btn" @click="saveMeeting">
          儲存
        </van-button>
        <van-button v-if="mtEditing !== 'new'" round block plain type="danger" class="del-btn" @click="removeMeeting">
          刪除會議
        </van-button>
      </div>
    </van-popup>

    <!-- 事項編輯 -->
    <van-popup
      :show="itEditing !== null"
      round
      closeable
      position="bottom"
      @update:show="(v: boolean) => !v && (itEditing = null)"
    >
      <div class="editor" v-if="itEditing">
        <h3>{{ itEditing.item ? '編輯事項' : '新增事項' }}</h3>
        <van-field v-model="itDraft.content" label="內容" type="textarea" rows="2" autosize
          maxlength="500" placeholder="決議或待討論事項" />
        <van-field v-model="itDraft.assignee" label="分工" maxlength="60" placeholder="負責人（姓名）" />
        <van-field v-model="itDraft.due_date" label="預計完成" placeholder="2026-08-29（選填）" />
        <p class="hint pop-label">狀態</p>
        <div class="tag-row">
          <van-tag
            v-for="st in MEETING_STATUS"
            :key="st.value"
            round
            size="large"
            :type="itDraft.status === st.value ? st.tagType : 'default'"
            :plain="itDraft.status !== st.value"
            @click="itDraft.status = st.value"
          >
            {{ st.label }}
          </van-tag>
        </div>
        <van-button round block type="primary" :loading="itSaving" class="save-btn" @click="saveItem">
          儲存
        </van-button>
        <van-button v-if="itEditing.item" round block plain type="danger" class="del-btn" @click="removeItem">
          刪除事項
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
.mt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mt-title strong {
  font-size: 19px;
}
.mt-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.minutes {
  margin: 4px 0 10px;
  font-size: 17px;
  white-space: pre-wrap;
}
.blk-title {
  margin: 10px 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--kll-primary-dark);
  display: flex;
  align-items: center;
  gap: 10px;
}
.blk-btn {
  margin-left: auto;
}
.item-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--kll-bg);
}
.item-row:last-of-type {
  border-bottom: none;
}
.st-tag {
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
}
.item-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.item-content {
  margin: 0;
  font-size: 17px;
}
.item-content.done {
  color: var(--kll-sub);
  text-decoration: line-through;
}
.item-meta {
  margin: 4px 0 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.overdue {
  color: #c4453c;
  font-weight: 700;
}
.mt-meta {
  margin: 10px 0 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.foot-tip {
  margin-top: 8px;
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
