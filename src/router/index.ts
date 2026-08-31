import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types'

const router = createRouter({
  history: createWebHistory(),
  // 換頁一律回到頂端（v9 #8）：手機從下方分頁切換時，若沿用捲動位置會看不到上方內容。
  // 不還原 savedPosition——分頁切換是「換頁」而非「返回」。
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      // 忘記密碼重設頁（v5 #4）：由信中連結進入，連結會自動帶登入 session
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
    },
    {
      path: '/',
      component: () => import('../components/TabbarLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'home', component: () => import('../views/HomeView.vue') },
        {
          path: 'attendance',
          name: 'attendance',
          component: () => import('../views/AttendanceView.vue'),
          meta: { roles: ['parent'] },
        },
        {
          path: 'checkin',
          name: 'checkin',
          component: () => import('../views/CheckInView.vue'),
          meta: { roles: ['teacher'] },
        },
        {
          path: 'members',
          name: 'members',
          component: () => import('../views/MembersView.vue'),
          meta: { roles: ['admin'] },
        },
        {
          path: 'songs',
          name: 'songs',
          component: () => import('../views/SongsView.vue'),
          meta: { requiresApproval: true },
        },
        {
          path: 'service',
          name: 'service',
          component: () => import('../views/ServiceView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'lesson-plans',
          name: 'lesson-plans',
          component: () => import('../views/LessonPlanView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'class-info',
          name: 'class-info',
          component: () => import('../views/ClassInfoView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'materials',
          name: 'materials',
          component: () => import('../views/MaterialsView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'meetings',
          name: 'meetings',
          component: () => import('../views/MeetingsView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'org',
          name: 'org',
          component: () => import('../views/OrgView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'records',
          name: 'records',
          component: () => import('../views/RecordsView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'class-log',
          name: 'class-log',
          component: () => import('../views/ClassLogView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          // 國度領袖兒童異象（計畫核心）：全員可看，未審核者也看得到
          path: 'vision',
          name: 'vision',
          component: () => import('../views/VisionView.vue'),
        },
        { path: 'me', name: 'me', component: () => import('../views/ProfileView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' }
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'home' }
  // 審核制：未審核者僅能使用首頁（公告）與我的（帳號設定）
  if (to.meta.requiresApproval && auth.profile && !auth.isApproved) return { name: 'home' }
  // 標籤式權限：具備任一所需角色標籤即可進入（can() 內含審核檢查）
  const required = to.meta.roles as UserRole[] | undefined
  if (required && auth.profile && !required.some((r) => auth.can(r))) return { name: 'home' }
  return true
})

export default router
