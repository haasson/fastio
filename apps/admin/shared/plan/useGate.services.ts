import { computed, type ComputedRef } from 'vue'
import { ok, deny, useGateInfra } from '~/shared/plan/useGate.shared'
import type { GateResult } from '~/shared/plan/useGate.types'

/**
 * Гейты services-вертикали (запись на услуги, каталог услуг).
 *
 * Возвращает только services-специфичные ключи. Услуги, которым нужны
 * shared-гейты (`viewSettings`, `viewBranches`, `dashboard` и т.п.) — берут
 * их через `useGate()` (агрегатор, в allow-list).
 *
 * Цель split-а: services-код, импортя `useGateServices()`, физически не имеет
 * доступа к retail-гейтам — типы про них не знают.
 */
export type ServicesGateKey
  = | 'services'
    | 'viewServiceMenu' | 'manageServiceMenu'
    | 'viewAppointments' | 'manageAppointments' | 'viewAllAppointments'

export type ServicesGateRegistry = Record<ServicesGateKey, ComputedRef<GateResult>>

export const useGateServices = (): ServicesGateRegistry => {
  const { tenantStore, isSuspended, isOwner, moduleGate, permissionGate } = useGateInfra()

  const services = moduleGate('services')

  const serviceMenu = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!tenantStore.isServices) return deny('absent')

    return services.value
  })

  const viewServiceMenu = permissionGate(serviceMenu, 'menu.view')
  const manageServiceMenu = permissionGate(serviceMenu, 'menu.edit')

  const viewAppointments = permissionGate(services, 'appointments.view')
  const manageAppointments = permissionGate(services, 'appointments.manage')

  // Сводный список визитов (`/appointments/list`, `/appointments`) — там видны
  // чужие клиенты (имя, телефон). Мастер с `view_own` (без `view_all`) сюда
  // не пускается: ему доступен только таймлайн со своими ресурсами и
  // компактная страница `/appointments/appointment/[id]` для своей услуги.
  // Backwards-compat: ни одного из ключей view_all/view_own → разрешено
  // (легаси-роли с одним `appointments.view`).
  const viewAllAppointments = computed<GateResult>(() => {
    if (isSuspended.value) return deny('suspended')
    if (!viewAppointments.value.enabled) return viewAppointments.value
    if (isOwner.value) return ok()
    const perms = tenantStore.currentPermissions

    if (perms?.['appointments.view_own'] === true && perms?.['appointments.view_all'] !== true) {
      return deny('forbidden')
    }

    return ok()
  })

  return {
    services,
    viewServiceMenu,
    manageServiceMenu,
    viewAppointments,
    manageAppointments,
    viewAllAppointments,
  }
}
