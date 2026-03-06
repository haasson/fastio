import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Branch } from '@fastio/shared'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

const STORAGE_KEY = 'fastio_current_branch'

export const useBranchStore = defineStore('branch', () => {
  const { $supabase } = useNuxtApp()
  const api = useSupabaseApi()

  const branches = ref<Branch[]>([])
  const currentBranchId = ref<string | null>(null)
  let channel: RealtimeChannel | null = null

  // null = "все филиалы"
  const currentBranch = computed(() => currentBranchId.value
    ? branches.value.find((b) => b.id === currentBranchId.value) ?? null
    : null,
  )

  const hasBranches = computed(() => branches.value.length > 0)

  const init = async (tenantId: string, memberBranchIds: string[], isAdmin: boolean) => {
    branches.value = await api.branches.list(tenantId)

    if (branches.value.length === 0) return

    // Determine available branches for current user
    const available = isAdmin || memberBranchIds.length === 0
      ? branches.value
      : branches.value.filter((b) => memberBranchIds.includes(b.id))

    // Restore from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    const savedAll = saved === 'all' && (isAdmin || memberBranchIds.length === 0)
    const savedValid = saved && saved !== 'all' && available.some((b) => b.id === saved)

    if (savedAll) {
      currentBranchId.value = null
    } else if (savedValid) {
      currentBranchId.value = saved
    } else if (isAdmin || memberBranchIds.length === 0) {
      // Admin with multiple branches — "all" by default
      currentBranchId.value = null
    } else {
      // Staff restricted to branches — pick first
      currentBranchId.value = available[0]?.id ?? null
      if (currentBranchId.value) localStorage.setItem(STORAGE_KEY, currentBranchId.value)
    }

    // Subscribe to realtime
    channel?.unsubscribe()
    channel = $supabase
      .channel(`branches:${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'branches',
        filter: `tenant_id=eq.${tenantId}`,
      }, async () => {
        branches.value = await api.branches.list(tenantId)
      })
      .subscribe()
  }

  const setBranch = (id: string | null) => {
    currentBranchId.value = id
    localStorage.setItem(STORAGE_KEY, id ?? 'all')
  }

  const dispose = () => {
    channel?.unsubscribe()
    channel = null
    branches.value = []
    currentBranchId.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    branches,
    currentBranchId,
    currentBranch,
    hasBranches,
    init,
    setBranch,
    dispose,
  }
})
