import { computed } from 'vue'
import type { PermissionKey } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

/**
 * Низкоуровневый permission-чекер. Большинство компонентов должны
 * использовать `useGate()` — он учитывает не только роль, но и план,
 * модули, suspended-состояние и т.д.
 *
 * `usePermissions` оставлен только для динамических проверок (когда
 * ключ пермишена приходит из данных, например из конфига туров).
 */
export const usePermissions = () => {
  const tenantStore = useTenantStore()

  const can = (key: PermissionKey) => computed(() => {
    if (tenantStore.isOwner) return true
    const perms = tenantStore.currentPermissions

    return perms?.[key] === true
  })

  return { can }
}
