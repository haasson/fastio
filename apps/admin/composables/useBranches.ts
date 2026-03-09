import { computed, ref, watch, type Ref } from 'vue'
import type { Branch, BranchFormData } from '@fastio/shared'
import { mapBranch } from '~/utils/api/branches'
import { useRealtimeList } from '~/composables/useRealtimeList'
import { useDatabase } from '~/composables/useDatabase'

export const useBranches = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const archivedBranches = ref<Branch[]>([])

  const { items: branches, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `branches:${tenantId.value}` : null),
    table: 'branches',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.branches.list(tenantId.value),
    mapper: mapBranch,
    shouldInclude: (branch) => !branch.archivedAt,
  })

  const fetchArchived = async () => {
    if (!tenantId.value) return
    archivedBranches.value = await api.branches.listArchived(tenantId.value)
  }

  watch(tenantId, (id) => {
    if (id) fetchArchived()
  }, { immediate: true })

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

  const archive = async (id: string) => {
    const branch = await api.branches.archive(id)

    branches.value = branches.value.filter((b) => b.id !== id)
    if (branch) archivedBranches.value.unshift(branch)
  }

  const restore = async (id: string) => {
    const branch = await api.branches.restore(id)

    archivedBranches.value = archivedBranches.value.filter((b) => b.id !== id)
    if (branch) branches.value.push(branch)
  }

  return { branches, archivedBranches, loading, add, update, archive, restore }
}
