import { ref, computed, type Ref } from 'vue'
import type { AddonPreset } from '@fastio/shared'
import { mapAddon } from '../api/addons'
import { useRealtimeList } from '~/shared/data/useRealtimeList'
import { useDatabase } from '~/shared/data/useDatabase'
import { reportError } from '@fastio/shared/observability'

export function useAddons(tenantId: Ref<string>) {
  const api = useDatabase()

  const { items: addons, loading } = useRealtimeList({
    channelKey: computed(() => tenantId.value ? `addons:${tenantId.value}` : null),
    table: 'addons',
    filter: computed(() => `tenant_id=eq.${tenantId.value}`),
    fetch: () => api.addons.list(tenantId.value),
    mapper: mapAddon,
  })

  const presets = ref<AddonPreset[]>([])
  const presetsLoading = ref(false)

  const loadPresets = async () => {
    if (!tenantId.value) return
    presetsLoading.value = true
    presets.value = await api.addons.listPresets(tenantId.value)
    presetsLoading.value = false
  }

  // ---- Addons ----

  const add = async (data: { name: string; weight: number | null; price: number }) => {
    if (!tenantId.value) return
    const addon = await api.addons.add(tenantId.value, data)

    if (addon) addons.value.push(addon)
  }

  const update = async (id: string, data: Partial<{ name: string; weight: number | null; price: number; active: boolean; order: number }>) => {
    const addon = await api.addons.update(id, data)

    if (!addon) return
    const i = addons.value.findIndex((a) => a.id === id)

    if (i !== -1) addons.value[i] = addon
  }

  const remove = async (id: string) => {
    await api.addons.remove(id)
    addons.value = addons.value.filter((a) => a.id !== id)
  }

  const toggleActive = async (id: string, active: boolean) => {
    const addon = addons.value.find((a) => a.id === id)

    if (!addon) return
    const prev = addon.active

    addon.active = active
    try {
      await api.addons.toggleActive(id, active)
    } catch (e) {
      addon.active = prev
      reportError(e)
      throw e
    }
  }

  // ---- Presets ----

  const addPreset = async (name: string, addonIds: string[]) => {
    if (!tenantId.value) return
    const preset = await api.addons.addPreset(tenantId.value, name, addonIds)

    if (preset) presets.value.push(preset)
  }

  const updatePreset = async (id: string, name: string, addonIds: string[]) => {
    await api.addons.updatePreset(id, name, addonIds)
    const i = presets.value.findIndex((p) => p.id === id)

    if (i !== -1) presets.value[i] = { ...presets.value[i], name, addonIds }
  }

  const removePreset = async (id: string) => {
    await api.addons.removePreset(id)
    presets.value = presets.value.filter((p) => p.id !== id)
  }

  return {
    addons,
    loading,
    presets,
    presetsLoading,
    loadPresets,
    add,
    update,
    remove,
    toggleActive,
    addPreset,
    updatePreset,
    removePreset,
  }
}
