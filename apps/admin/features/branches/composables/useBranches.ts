import { computed, ref, watch, type Ref } from 'vue'
import type { Branch, BranchFormData } from '@fastio/shared'
import { mapBranch } from '../api/branches'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'

export const useBranches = (tenantId: Ref<string>) => {
  const api = useDatabase()
  const { log } = useAuditLog()

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

    if (!branch) return
    branches.value.push(branch)
    log({
      action: 'branch.create',
      entityType: 'branch',
      entityId: branch.id,
      entityName: branch.name,
      payload: { address: branch.address },
    })
  }

  const update = async (id: string, data: Partial<BranchFormData>) => {
    const branch = await api.branches.update(id, data)

    if (!branch) return
    const i = branches.value.findIndex((b) => b.id === id)

    if (i !== -1) branches.value[i] = branch
    log({
      action: 'branch.update',
      entityType: 'branch',
      entityId: id,
      entityName: branch.name,
      payload: { changed: Object.keys(data) },
    })
  }

  const archive = async (id: string) => {
    const branch = branches.value.find((b) => b.id === id)
    const archived = await api.branches.archive(id)

    branches.value = branches.value.filter((b) => b.id !== id)
    if (archived) archivedBranches.value.unshift(archived)
    log({
      action: 'branch.archive',
      entityType: 'branch',
      entityId: id,
      entityName: branch?.name ?? null,
      payload: {},
    })
  }

  const restore = async (id: string) => {
    const branch = archivedBranches.value.find((b) => b.id === id)
    const restored = await api.branches.restore(id)

    archivedBranches.value = archivedBranches.value.filter((b) => b.id !== id)
    if (restored) branches.value.push(restored)
    log({
      action: 'branch.restore',
      entityType: 'branch',
      entityId: id,
      entityName: branch?.name ?? null,
      payload: {},
    })
  }

  return { branches, archivedBranches, loading, add, update, archive, restore }
}
