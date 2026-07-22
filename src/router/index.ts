import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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
          meta: { roles: ['parent', 'admin'] },
        },
        {
          path: 'checkin',
          name: 'checkin',
          component: () => import('../views/CheckInView.vue'),
          meta: { roles: ['teacher', 'admin'] },
        },
        {
          path: 'members',
          name: 'members',
          component: () => import('../views/MembersView.vue'),
          meta: { roles: ['admin'] },
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
  const roles = to.meta.roles as string[] | undefined
  if (roles && auth.role && !roles.includes(auth.role)) return { name: 'home' }
  return true
})

export default router
