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
        { path: 'songs', name: 'songs', component: () => import('../views/SongsView.vue') },
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
  // 標籤式權限：具備任一所需角色標籤即可進入（admin 於 can() 內放行）
  const required = to.meta.roles as UserRole[] | undefined
  if (required && auth.profile && !required.some((r) => auth.can(r))) return { name: 'home' }
  return true
})

export default router
