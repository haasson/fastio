import { computed } from 'vue'
import { useNuxtApp } from '#imports'
import type { BranchFormData } from '@fastio/shared'
import { branchesApi, mapBranch } from '~/utils/api/branches'
import { useRealtimeList } from '~/composables/useRealtimeList'

export const useBranches = (tenantId: Ref<string>) => {
  const { $supabase } = useNuxtApp()

  const { items: branches, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `branches:${tenantId.value}` : null),
    table: 'branches',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => branchesApi.list($supabase, tenantId.value),
    mapper: mapBranch,
  })

  const add = async (data: BranchFormData) => {
    if (!tenantId.value) return
    const branch = await branchesApi.add($supabase, tenantId.value, data)

    if (branch) branches.value.push(branch)
  }

  const update = async (id: string, data: Partial<BranchFormData>) => {
    const branch = await branchesApi.update($supabase, id, data)

    if (branch) {
      const i = branches.value.findIndex((b) => b.id === id)

      if (i !== -1) branches.value[i] = branch
    }
  }

  const remove = async (id: string) => {
    await branchesApi.remove($supabase, id)
    branches.value = branches.value.filter((b) => b.id !== id)
  }

  return { branches, loading, add, update, remove }
}
