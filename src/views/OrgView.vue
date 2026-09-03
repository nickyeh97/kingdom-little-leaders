<script setup lang="ts">
/**
 * 組織架構與分工：同工維護的一張架構圖（v8 #2）＋各班老師名單（v10 #1）。
 * 換架構＝換掉 `public/兒童部組織架構.png`，平台端不再提供新增/編輯。
 *
 * 家長也看得到這頁（v10 #1），但老師名單走 class_teachers() RPC，
 * 資料庫層就限定「家長只看得到自己孩子班別的老師」，且**只有稱呼、沒有聯絡方式**。
 */
import { computed, onMounted, ref } from 'vue'
import { showFailToast } from 'vant'
import ImageBoard from '../components/ImageBoard.vue'
import { listClassGroups } from '../api/checkin'
import { listClassTeachers } from '../api/roster'
import { classTagStyle } from '../lib/classColor'
import { teachersOfClass } from '../lib/parentLesson'
import { useAuthStore } from '../stores/auth'
import type { ClassGroup, ClassTeacher } from '../types'

const auth = useAuthStore()
const groups = ref<ClassGroup[]>([])
const teachers = ref<ClassTeacher[]>([])
const loading = ref(true)

/** 只列出「我看得到老師」的班別：家長＝自己孩子的班別，同工＝全部 */
const visibleGroups = computed(() =>
  groups.value.filter((g) => teachers.value.some((t) => t.class_group_id === g.id)),
)

const isStaff = computed(() => auth.can('teacher') || auth.can('admin'))

onMounted(async () => {
  try {
    const [gs, ts] = await Promise.all([listClassGroups(), listClassTeachers()])
    groups.value = gs
    teachers.value = ts
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <ImageBoard
      title="組織架構與分工"
      hint="兒童部的督導、主責同工與各班負責同工（點圖可放大）"
      src="/兒童部組織架構.png"
      alt="兒童部組織架構與分工"
    />

    <div class="page teachers">
      <h3>{{ isStaff ? '各班老師' : '孩子班上的老師' }}</h3>
      <van-loading v-if="loading" class="loading" />
      <template v-else>
        <div v-for="g in visibleGroups" :key="g.id" class="card">
          <van-tag :style="classTagStyle(g.name)">{{ g.name }}</van-tag>
          <p class="names">{{ teachersOfClass(teachers, g.id).join('、') }}</p>
        </div>
        <p v-if="visibleGroups.length === 0" class="card hint">
          {{
            isStaff
              ? '尚未指派班別老師，可於「名單與權限」設定。'
              : '目前沒有可顯示的班級老師。若孩子尚未綁定，請聯絡同工協助。'
          }}
        </p>
        <p class="foot-hint">名單僅顯示稱呼；聯絡方式請透過同工或班級群組取得。</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.teachers {
  padding-top: 0;
}
h3 {
  margin: 4px 0 8px;
  font-size: 18px;
}
.loading {
  text-align: center;
  padding: 16px 0;
}
.names {
  margin: 8px 0 0;
  font-size: 16px;
  line-height: 1.6;
}
.foot-hint {
  margin: 10px 2px 0;
  font-size: 13px;
  color: #8a9490;
}
</style>
