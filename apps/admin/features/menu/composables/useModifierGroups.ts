import { computed, type Ref } from 'vue'
import type { ModifierGroupFormData } from '@fastio/shared'
import { mapModifierGroup } from '../api/modifiers'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'

export function useModifierGroups(tenantId: Ref<string>) {
  const api = useDatabase()

  const { items: groups, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `modifier_groups:${tenantId.value}` : null),
    table: 'modifier_groups',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.modifiers.list(tenantId.value),
    mapper: mapModifierGroup,
  })

  const add = async (data: ModifierGroupFormData) => {
    if (!tenantId.value) return
    const group = await api.modifiers.add(tenantId.value, data)

    if (!group) return
    const existing = groups.value.findIndex((g) => g.id === group.id)

    if (existing !== -1) {
      groups.value[existing] = group
    } else {
      groups.value.push(group)
    }
  }

  const update = async (id: string, data: ModifierGroupFormData) => {
    const group = await api.modifiers.update(id, data)

    if (!group) return
    const i = groups.value.findIndex((g) => g.id === id)

    if (i !== -1) groups.value[i] = group
  }

  const remove = async (id: string) => {
    await api.modifiers.remove(id)
    groups.value = groups.value.filter((g) => g.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const group = groups.value.find((g) => g.id === id)

    if (group) group.active = active
    await api.modifiers.toggleActive(id, active)
  }

  return { groups, loading, add, update, remove, toggleActive }
}
