import { ref, reactive, watch, type Ref } from 'vue'
import type { Branch } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useBranchAvailability } from '~/composables/data/useBranchAvailability'

type BranchOverride = { branchId: string; price: number | null; active: boolean | null }

export const useEntityBranchSettings = (
  entity: Ref<'dish' | 'combo'>,
  entityId: Ref<string | null>,
  branches: Ref<Branch[]>,
  refreshKey: Ref<number>,
) => {
  const api = useDatabase()
  const { branchActive, resetAvailability, applyAvailability } = useBranchAvailability(branches)

  const useBranchSettings = ref(false)
  const branchPrices = reactive<Record<string, number | null>>({})

  const load = async (id: string) => {
    resetAvailability()
    branches.value.forEach((b) => {
      branchPrices[b.id] = null
    })

    const settings = entity.value === 'dish'
      ? await api.dishes.getBranchPrices(id)
      : await api.combos.getBranchSettings(id)

    settings.forEach((s) => {
      branchPrices[s.branchId] = s.price ?? null
    })
    applyAvailability(settings)
    useBranchSettings.value = settings.length > 0
  }

  const onToggle = (val: boolean) => {
    if (!val) {
      Object.keys(branchPrices).forEach((k) => {
        branchPrices[k] = null
      })
      resetAvailability()
    }
  }

  const getSettings = (): BranchOverride[] => {
    if (!useBranchSettings.value) return []

    return branches.value
      .filter((b) => branchPrices[b.id] != null || branchActive[b.id] === false)
      .map((b) => ({
        branchId: b.id,
        price: branchPrices[b.id] ?? null,
        active: branchActive[b.id] ?? null,
      }))
  }

  watch(refreshKey, () => {
    if (entityId.value && branches.value.length > 0) {
      load(entityId.value)
    } else {
      useBranchSettings.value = false
      Object.keys(branchPrices).forEach((k) => {
        branchPrices[k] = null
      })
      resetAvailability()
    }
  }, { immediate: true })

  const setBranchActive = (branchId: string, value: boolean | null) => {
    branchActive[branchId] = value
  }

  return { useBranchSettings, branchPrices, branchActive, onToggle, getSettings, setBranchActive }
}
