import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)

  const roles = computed<UserRole[]>(() => profile.value?.roles ?? [])
  const isAdmin = computed(() => roles.value.includes('admin'))
  const isLoggedIn = computed(() => session.value !== null)

  /** 是否具備某角色標籤（嚴格逐標籤授權：admin 不自動涵蓋其他角色功能） */
  function can(role: UserRole): boolean {
    return roles.value.includes(role)
  }

  async function loadProfile() {
    if (!supabase || !session.value) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.value.user.id)
      .single()
    if (!error) profile.value = data as Profile
  }

  /** App 啟動時呼叫一次：還原 session 並監聽變化 */
  async function init() {
    if (!supabase) {
      ready.value = true
      return
    }
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    if (session.value) await loadProfile()
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      if (!newSession) {
        profile.value = null
      } else if (!profile.value) {
        // OAuth 轉址回來的登入在 init 之後才觸發，需在此補載 profile
        // （setTimeout 避開 supabase-js 在 callback 內 await 的死鎖問題）
        setTimeout(() => void loadProfile(), 0)
      }
    })
    ready.value = true
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase 尚未設定')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await loadProfile()
  }

  /** Email 註冊；display_name 由資料庫觸發器寫入 profiles（預設角色：家長） */
  async function signUp(displayName: string, email: string, password: string) {
    if (!supabase) throw new Error('Supabase 尚未設定')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
    // 若專案關閉「Confirm email」會直接取得 session；否則需收確認信
    session.value = data.session
    if (data.session) await loadProfile()
    return data.session !== null
  }

  /** Google 登入/註冊（轉址流程；回來後由 onAuthStateChange 接手） */
  async function signInWithGoogle() {
    if (!supabase) throw new Error('Supabase 尚未設定')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  return {
    session,
    profile,
    ready,
    roles,
    isAdmin,
    can,
    isLoggedIn,
    init,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    loadProfile,
  }
})
