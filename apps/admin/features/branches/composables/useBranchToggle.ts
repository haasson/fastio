import type { Ref } from 'vue'

type Option = { value: string }

/**
 * Семантика «привязка к филиалам» (как у service_branches/dish_branches/combo_branches):
 * пустой массив = «во всех филиалах». Поэтому полный набор и пустой — это одно и то же,
 * а UI должен поддерживать инвариант «хотя бы один включён».
 *
 * Возвращает три хелпера для тогглеров с этим инвариантом, чтобы не дублировать
 * логику в SettingsSection (dish/combo) и ServiceDrawer.
 */
export function useBranchToggle(
  branchIds: Ref<string[]>,
  options: Ref<Option[]>,
  setBranchIds: (next: string[]) => void,
) {
  function isOn(branchId: string): boolean {
    if (branchIds.value.length === 0) return true

    return branchIds.value.includes(branchId)
  }

  // Последний включённый отключать нельзя — пустой набор означает «во всех», а UI
  // не должен скрытно превращать «только в этом одном» в «во всех».
  function isLastOn(branchId: string): boolean {
    if (!isOn(branchId)) return false
    if (branchIds.value.length === 0) return false

    return branchIds.value.length === 1 && branchIds.value[0] === branchId
  }

  function toggle(branchId: string, value: boolean) {
    const allIds = options.value.map((o) => o.value)
    let next: string[]

    if (branchIds.value.length === 0) {
      if (value) return
      next = allIds.filter((id) => id !== branchId)
    } else {
      if (value) {
        if (branchIds.value.includes(branchId)) return
        next = [...branchIds.value, branchId]
      } else {
        next = branchIds.value.filter((id) => id !== branchId)
      }
    }

    // Полный набор схлопываем в пустой — оба означают «во всех», но пустой нативнее
    // для бэка и не ломается, если позже добавится новый филиал.
    if (next.length === allIds.length) next = []

    setBranchIds(next)
  }

  return { isOn, isLastOn, toggle }
}
