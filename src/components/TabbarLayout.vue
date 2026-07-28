<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const tabs = computed(() => {
  const items = [{ name: 'home', label: '首頁', icon: 'wap-home-o' }]
  if (auth.can('parent')) items.push({ name: 'attendance', label: '出席', icon: 'todo-list-o' })
  if (auth.can('teacher')) items.push({ name: 'checkin', label: '點名', icon: 'checked' })
  items.push({ name: 'songs', label: '詩歌', icon: 'music-o' })
  // 「名單」管理入口在「我的」頁面內（避免分頁過多）
  items.push({ name: 'me', label: '我的', icon: 'user-o' })
  return items
})

const active = computed({
  get: () => (route.name as string) ?? 'home',
  set: (name: string) => router.push({ name }),
})
</script>

<template>
  <div>
    <router-view />
    <van-tabbar v-model="active" fixed placeholder safe-area-inset-bottom>
      <van-tabbar-item v-for="t in tabs" :key="t.name" :name="t.name" :icon="t.icon">
        {{ t.label }}
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>
