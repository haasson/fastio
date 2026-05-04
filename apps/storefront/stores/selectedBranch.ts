import { defineStore } from 'pinia'
import { ref } from 'vue'
import { reportError } from '~/utils/reportError'

const STORAGE_KEY = 'fs-selected-branch-id'

export const useSelectedBranchStore = defineStore('selected-branch', () => {
  const id = ref<string | null>(null)
  const restored = ref(false)

  function restore() {
    if (!import.meta.client) return
    try {
      id.value = localStorage.getItem(STORAGE_KEY)
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.restore] localStorage read failed'))
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
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.set] localStorage write failed'))
    }
  }

  function clear() {
    id.value = null
    if (!import.meta.client) return
    try {
      localStorage.removeItem(STORAGE_KEY)
    }
    catch (e) {
      reportError(e instanceof Error ? e : new Error('[selectedBranch.clear] localStorage remove failed'))
    }
  }

  return { id, restored, restore, set, clear }
})
