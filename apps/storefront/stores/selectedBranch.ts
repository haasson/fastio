import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCookie } from 'nuxt/app'
import { reportError } from '~/utils/reportError'

const STORAGE_KEY = 'fs-selected-branch-id'
// Cookie позволяет SSR увидеть выбранный филиал и отдать сразу отфильтрованный
// каталог, без FOUC и без флэша «все филиалы» для SEO-ботов.
const COOKIE_KEY = 'fs-selected-branch-id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 год

export const useSelectedBranchStore = defineStore('selected-branch', () => {
  const id = ref<string | null>(null)
  const restored = ref(false)

  // На SSR куку читаем сразу при создании стора (в setup-context'е useCookie работает).
  // На клиенте restore() инициализирует из localStorage (мастер-источник: cookie
  // обновляется при каждом set/clear, но миграция с старых сессий через ls).
  if (!import.meta.client) {
    try {
      const cookie = useCookie<string | null>(COOKIE_KEY)
      if (cookie.value) {
        id.value = cookie.value
        restored.value = true
      }
    } catch {
      // useCookie может не работать вне Nuxt-context (тесты) — игнорируем.
    }
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const fromLs = localStorage.getItem(STORAGE_KEY)
      // Cookie приоритетнее (синхронен с SSR-выдачей), но если её нет —
      // подхватываем legacy localStorage-сессию и переносим в cookie.
      const cookie = useCookie<string | null>(COOKIE_KEY, { maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
      const fromCookie = cookie.value
      const value = fromCookie ?? fromLs
      id.value = value
      if (value && !fromCookie) cookie.value = value
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.restore] read failed'))
    }
    finally {
      restored.value = true
    }
  }

  function set(branchId: string) {
    id.value = branchId
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, branchId)
      const cookie = useCookie<string | null>(COOKIE_KEY, { maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
      cookie.value = branchId
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.set] write failed'))
    }
  }

  function clear() {
    id.value = null
    if (!import.meta.client) return
    try {
      localStorage.removeItem(STORAGE_KEY)
      const cookie = useCookie<string | null>(COOKIE_KEY)
      cookie.value = null
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.clear] remove failed'))
    }
  }

  return { id, restored, restore, set, clear }
})
