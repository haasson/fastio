import { computed, type Ref } from 'vue'
import type { Combo, ComboFormData } from '@fastio/shared'
import { mapCombo } from '../api/combos'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '~/shared/utils/reportError'

export function useCombos(tenantId: Ref<string>, categoryId: Ref<string | null>) {
  const api = useDatabase()

  const { items: combos, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value && categoryId.value ? `combos:${tenantId.value}:${categoryId.value}` : null),
    table: 'combos',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.combos.list(tenantId.value, categoryId.value!),
    mapper: mapCombo,
    shouldInclude: (combo) => combo.categoryId === categoryId.value,
  })

  const add = async (data: ComboFormData): Promise<Combo | null> => {
    if (!tenantId.value || !categoryId.value) return null
    const combo = await api.combos.add(tenantId.value, categoryId.value, data)

    if (combo) combos.value.push(combo)

    return combo
  }

  const update = async (id: string, data: Partial<ComboFormData>) => {
    const combo = await api.combos.update(id, data)

    if (!combo) return
    const i = combos.value.findIndex((c) => c.id === id)

    if (i !== -1) combos.value[i] = combo
  }

  const remove = async (id: string) => {
    await api.combos.remove(id)
    combos.value = combos.value.filter((c) => c.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const combo = combos.value.find((c) => c.id === id)

    if (!combo) return
    const prev = combo.active

    combo.active = active
    try {
      await api.combos.toggleActive(id, active)
    } catch (e) {
      combo.active = prev
      reportError(e)
      throw e
    }
  }

  const reorder = async (reordered: Combo[]) => {
    const prev = combos.value

    combos.value = reordered
    try {
      await api.combos.reorder(reordered.map((c, i) => ({ id: c.id, order: i })))
    } catch (e) {
      combos.value = prev
      reportError(e)
      throw e
    }
  }

  return { combos, loading, add, update, remove, toggleActive, reorder }
}

export default useCombos
