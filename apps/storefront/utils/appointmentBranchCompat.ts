import type { ServiceCartItem } from '~/stores/cart'

/**
 * Урезанный тип услуги — только поля, нужные для compat-проверки.
 * branchIds: [] = доступна во всех филиалах.
 */
export type ServiceCompat = {
  id: string
  branchIds: string[]
}

/**
 * Урезанный тип ресурса — только поля, нужные для compat-проверки.
 * branchIds: [] = доступен во всех филиалах.
 */
export type ResourceCompat = {
  id: string
  branchIds: string[]
}

export type AppointmentBranchResetResult = {
  /** Услуги, совместимые с newBranchId */
  survivors: ServiceCartItem[]
  /** Услуги, недоступные в newBranchId */
  dropped: ServiceCartItem[]
  /** serviceId'ы услуг, у которых сбросили preferredResourceId (мастер не работает в новом филиале) */
  resourcesReset: string[]
}

type CalcOptions = {
  /**
   * При true — сбрасываем preferredResourceId у ВСЕХ услуг с выбранным мастером
   * (используется как safe-fallback когда `/api/appointments/resource-branches`
   * упал и мы не можем точно сказать, кто работает в новом филиале).
   */
  forceResetAllMasters?: boolean
}

/**
 * Чистая функция: вычисляет что останется в корзине записей при смене филиала.
 *
 * - survivors: услуга совместима, если её branchIds.length === 0 (везде) или включает newBranchId
 * - dropped: несовместимые
 * - resourcesReset: среди survivors — те, у кого preferredResourceId задан и ресурс
 *   привязан к филиалу, отличному от newBranchId. Их preferredResourceId нужно обнулить.
 */
export function calcAppointmentBranchReset(
  items: ServiceCartItem[],
  newBranchId: string,
  allServices: ServiceCompat[],
  allResources: ResourceCompat[],
  options: CalcOptions = {},
): AppointmentBranchResetResult {
  const serviceById = new Map(allServices.map((s) => [s.id, s]))
  const resourceById = new Map(allResources.map((r) => [r.id, r]))

  const survivors: ServiceCartItem[] = []
  const dropped: ServiceCartItem[] = []
  const resourcesReset: string[] = []

  for (const item of items) {
    const svc = serviceById.get(item.serviceId)
    // Если услуга неизвестна — считаем её глобально доступной (fallback: не дропаем).
    // useBranchSwitcher грузит `servicesStore.allServices` который в per_branch-режиме
    // отфильтрован по ТЕКУЩЕМУ филиалу — услуги доступные только в новом филиале
    // не появятся в карте, и мы их сохраняем (после смены reconcile подгрузит).
    const isCompatible = !svc || svc.branchIds.length === 0 || svc.branchIds.includes(newBranchId)

    if (!isCompatible) {
      dropped.push(item)
      continue
    }

    survivors.push(item)

    // Проверяем, доступен ли выбранный мастер в новом филиале
    if (item.preferredResourceId) {
      if (options.forceResetAllMasters) {
        resourcesReset.push(item.serviceId)
      } else {
        const resource = resourceById.get(item.preferredResourceId)
        if (resource && resource.branchIds.length > 0 && !resource.branchIds.includes(newBranchId)) {
          resourcesReset.push(item.serviceId)
        }
      }
    }
  }

  return { survivors, dropped, resourcesReset }
}
