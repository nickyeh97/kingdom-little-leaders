import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
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
