import { computed } from 'vue'
import type { BranchFormData } from '@fastio/shared'
import { mapBranch } from '~/utils/api/branches'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export const useBranches = (tenantId: Ref<string>) => {
  const api = useSupabaseApi()

  const { items: branches, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `branches:${tenantId.value}` : null),
    table: 'branches',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.branches.list(tenantId.value),
    mapper: mapBranch,
  })

  const add = async (data: BranchFormData) => {
    if (!tenantId.value) return
    const branch = await api.branches.add(tenantId.value, data)

    if (branch) branches.value.push(branch)
  }

  const update = async (id: string, data: Partial<BranchFormData>) => {
    const branch = await api.branches.update(id, data)

    if (branch) {
      const i = branches.value.findIndex((b) => b.id === id)

      if (i !== -1) branches.value[i] = branch
    }
  }

  const remove = async (id: string) => {
    await api.branches.remove(id)
    branches.value = branches.value.filter((b) => b.id !== id)
  }

  return { branches, loading, add, update, remove }
}
