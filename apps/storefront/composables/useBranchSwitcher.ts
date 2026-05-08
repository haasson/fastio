import { useSelectedBranchStore } from '~/stores/selectedBranch'
import { useCartStore, isDishItem, isServiceItem, type CartItem } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useServicesStore } from '~/stores/services'
import { useConfirm, type ConfirmSection } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'
import { getMissingBranchDishNames } from '~/utils/branchCompat'
import { calcAppointmentBranchReset, type ResourceCompat } from '~/utils/appointmentBranchCompat'
import { reportError } from '~/utils/reportError'

/**
 * Смена филиала в режиме per_branch.
 *
 * Считаем потери в обеих частях корзины (dishes + services) и при необходимости —
 * у каких услуг сбросится выбранный мастер. Если хоть что-то теряется — показываем
 * structured confirm с разбивкой по секциям. При отказе ничего не меняется.
 *
 * Живёт отдельно от модалки/шапки/любого UI — чтобы любой инициатор смены филиала
 * (BranchPickerModal, header switcher, deep-link) шёл через одну точку, и нельзя
 * было случайно поменять филиал и оставить корзину с фантомами.
 *
 * Возвращает true, если филиал сменён; false, если пользователь отменил.
 */
export function useBranchSwitcher() {
  const branchStore = useSelectedBranchStore()
  const cartStore = useCartStore()
  const menuStore = useMenuStore()
  const servicesStore = useServicesStore()
  const { confirm } = useConfirm()
  const toast = useToast()

  // null = не удалось загрузить, надо safe-fallback (сбросить всех мастеров).
  async function loadResourceBranches(resourceIds: string[]): Promise<ResourceCompat[] | null> {
    if (resourceIds.length === 0) return []
    try {
      const params = new URLSearchParams({ ids: resourceIds.join(',') })
      const map = await $fetch<Record<string, string[]>>(
        `/api/appointments/resource-branches?${params.toString()}`,
      )
      return resourceIds.map((id) => ({ id, branchIds: map[id] ?? [] }))
    } catch (e) {
      reportError(e instanceof Error ? e : new Error('[useBranchSwitcher] failed to load resource branches'))
      return null
    }
  }

  // gen-counter защищает от race: пользователь быстро кликает A→B→C, и
  // resource-branches для A приходит позже, чем для C — устаревший ответ
  // не должен применяться к корзине.
  let switchGen = 0

  async function switchTo(id: string): Promise<boolean> {
    if (id === branchStore.id) return true
    const myGen = ++switchGen

    // ── Считаем dish-конфликты ────────────────────────────────────────────────
    const dishItems = cartStore.dishItems
    const dishesById = new Map(menuStore.allDishes.map((d) => [d.id, d]))
    const missingDishNames = dishItems.length > 0
      ? getMissingBranchDishNames(dishItems, dishesById, id, menuStore.branchesAll.length)
      : []

    // ── Считаем service-конфликты ─────────────────────────────────────────────
    const serviceItems = cartStore.serviceItems
    // servicesStore.allServices в per_branch-режиме отфильтрован по ТЕКУЩЕМУ
    // филиалу — для compat-чека нужен полный набор. Дёргаем unfiltered каталог
    // одним запросом с ?all=1.
    let allServices: Array<{ id: string; branchIds: string[] }> = []
    if (serviceItems.length > 0) {
      try {
        const catalog = await $fetch<{ services: Array<{ id: string; branchIds: string[] }> }>(
          '/api/services-catalog?all=1',
        )
        allServices = (catalog.services ?? []).map((s) => ({ id: s.id, branchIds: s.branchIds }))
      } catch (e) {
        // Fallback на отфильтрованный кэш — лучше чем уронить смену филиала.
        reportError(e instanceof Error ? e : new Error('[useBranchSwitcher] failed to load full catalog'))
        allServices = servicesStore.allServices.map((s) => ({ id: s.id, branchIds: s.branchIds }))
      }
      if (myGen !== switchGen) return false
    }

    // Подгружаем resource_branches только для услуг с выбранным мастером —
    // нужно для точного списка «у X сбросится мастер».
    const resourceIdsToCheck = serviceItems
      .map((i) => i.preferredResourceId)
      .filter((rid): rid is string => rid !== null)
    const loadedResources = await loadResourceBranches([...new Set(resourceIdsToCheck)])
    if (myGen !== switchGen) return false

    // Safe fallback: если не удалось проверить — сбрасываем всех мастеров через
    // явный флаг, без магической строки '__unknown__' в branchIds.
    const resourcesUnavailable = loadedResources === null
    const allResources: ResourceCompat[] = loadedResources ?? []

    if (resourcesUnavailable) {
      toast.warning('Не удалось проверить мастеров — выбор сбросится, выберите заново.')
    }

    const serviceReset = serviceItems.length > 0
      ? calcAppointmentBranchReset(serviceItems, id, allServices, allResources, {
        forceResetAllMasters: resourcesUnavailable,
      })
      : null

    const droppedServiceItems = serviceReset?.dropped ?? []
    const resetMasterServiceIds = new Set(serviceReset?.resourcesReset ?? [])
    // Имена услуг, у которых сбросится мастер (берём из survivors — у dropped мастер уже не важен).
    const resetMasterServiceNames = (serviceReset?.survivors ?? [])
      .filter((s) => resetMasterServiceIds.has(s.serviceId))
      .map((s) => s.serviceName)

    // ── Если есть потери — confirm с разбивкой ────────────────────────────────
    const hasLosses = missingDishNames.length > 0
      || droppedServiceItems.length > 0
      || resetMasterServiceNames.length > 0

    if (hasLosses) {
      const sections: ConfirmSection[] = []

      if (missingDishNames.length > 0) {
        sections.push({ title: 'Удалятся из корзины', items: missingDishNames })
      }

      if (droppedServiceItems.length > 0) {
        sections.push({
          title: 'Удалятся услуги (нет в этом филиале)',
          items: droppedServiceItems.map((s) => s.serviceName),
        })
      }

      if (resetMasterServiceNames.length > 0) {
        sections.push({
          title: 'Сбросится выбор мастера',
          items: resetMasterServiceNames,
        })
      }

      const ok = await confirm('Эти позиции недоступны в новом филиале — придётся внести изменения в корзину.', {
        title: 'Сменить филиал?',
        confirmLabel: 'Сменить',
        cancelLabel: 'Остаться',
        danger: true,
        sections,
      })

      if (!ok) return false
      if (myGen !== switchGen) return false
    }

    // ── Применяем изменения к корзине ────────────────────────────────────────
    let nextItems: CartItem[] = cartStore.items

    if (missingDishNames.length > 0) {
      const totalBranches = menuStore.branchesAll.length

      nextItems = nextItems.filter((it) => {
        if (!isDishItem(it)) return true
        if (!it.dishId) return true
        const dish = dishesById.get(it.dishId)

        if (!dish) return true

        return (
          dish.branchIds.length === 0
          || dish.branchIds.length >= totalBranches
          || dish.branchIds.includes(id)
        )
      })
    }

    if (serviceReset) {
      const survivorKeys = new Set(serviceReset.survivors.map((s) => s._key))

      nextItems = nextItems.flatMap<CartItem>((it) => {
        if (!isServiceItem(it)) return [it]
        if (!survivorKeys.has(it._key)) return []

        // Survivor — обновляем branchId, при необходимости сбрасываем мастера.
        return [{
          ...it,
          branchId: id,
          preferredResourceId: resetMasterServiceIds.has(it.serviceId) ? null : it.preferredResourceId,
        }]
      })
    }

    if (nextItems !== cartStore.items) {
      cartStore.replaceAll(nextItems)
    }

    branchStore.set(id)

    return true
  }

  return { switchTo }
}
