import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)

  const role = computed<UserRole | null>(() => profile.value?.role ?? null)
  const isLoggedIn = computed(() => session.value !== null)

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
      if (!newSession) profile.value = null
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

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  return { session, profile, ready, role, isLoggedIn, init, signIn, signOut, loadProfile }
})
