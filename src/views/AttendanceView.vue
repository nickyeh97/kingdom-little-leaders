<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showFailToast, showSuccessToast } from 'vant'
import { listMyChildren, listPlans, upsertPlans } from '../api/attendance'
import { formatSunday, isPlanOpen, planDeadline, upcomingSunday } from '../lib/sunday'
import type { AttendanceStatus, Child } from '../types'

const sunday = upcomingSunday()
const open = isPlanOpen(sunday)

const children = ref<Child[]>([])
const statusMap = ref<Record<string, AttendanceStatus>>({})
const noteMap = ref<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)

const options: { value: AttendanceStatus; label: string }[] = [
  { value: 'attending', label: '出席' },
  { value: 'leave', label: '請假' },
  { value: 'undecided', label: '未定' },
]

const attendingCount = computed(
  () => Object.values(statusMap.value).filter((s) => s === 'attending').length,
)

onMounted(async () => {
  try {
    const [kids, plans] = await Promise.all([listMyChildren(), listPlans(sunday)])
    children.value = kids
    const byChild = new Map(plans.map((p) => [p.child_id, p]))
    for (const kid of kids) {
      statusMap.value[kid.id] = byChild.get(kid.id)?.status ?? 'undecided'
      noteMap.value[kid.id] = byChild.get(kid.id)?.note ?? ''
    }
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

async function submit() {
  saving.value = true
  try {
    await upsertPlans(
      sunday,
      children.value.map((c) => ({
        child_id: c.id,
        status: statusMap.value[c.id],
        note: noteMap.value[c.id]?.trim() || null,
      })),
    )
    showSuccessToast('已送出，感謝配合！')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h2>本週出席勾選</h2>
    <p class="hint">
      {{ formatSunday(sunday) }} ·
      {{ open ? `${planDeadline(sunday).toLocaleDateString('zh-TW')}（週三）23:59 前可修改` : '本週已截止，如有變動請聯繫窗口' }}
    </p>

    <van-skeleton v-if="loading" title :row="4" />
    <template v-else>
      <div v-for="c in children" :key="c.id" class="card">
        <div class="kid">
          <strong>{{ c.name }}</strong>
          <van-tag plain type="primary">{{ c.class_groups?.name ?? '' }}</van-tag>
        </div>
        <div class="seg">
          <van-button
            v-for="o in options"
            :key="o.value"
            size="small"
            :type="statusMap[c.id] === o.value ? 'primary' : 'default'"
            :disabled="!open"
            @click="statusMap[c.id] = o.value"
          >
            {{ o.label }}
          </van-button>
        </div>
        <van-field
          v-model="noteMap[c.id]"
          class="note"
          type="textarea"
          rows="1"
          autosize
          maxlength="200"
          placeholder="給老師的話（選填），例：這週會晚 15 分鐘到"
          :disabled="!open"
        />
      </div>

      <div v-if="children.length === 0" class="card hint">
        尚未綁定孩子，請聯繫兒主窗口協助綁定。
      </div>

      <div class="card hint">勾選結果僅供同工預備教材與點心，臨時變動也沒關係 😊</div>

      <van-button
        v-if="children.length > 0"
        round
        block
        type="primary"
        :loading="saving"
        :disabled="!open"
        @click="submit"
      >
        送出本週出席（{{ attendingCount }} 位出席）
      </van-button>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.kid {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.note {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--kll-bg);
  border-radius: 10px;
}
</style>
