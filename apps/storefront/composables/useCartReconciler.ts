import { watch } from 'vue'
import type { Ref } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { reconcileCart, reconcileServices } from '@fastio/shared'
import type { ReconcileService, Dish, Combo, DishModifierGroup, RemovedServiceItem } from '@fastio/shared'
import { useCartStore, type DishCartItem, type ServiceCartItem } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'
import { useToast } from '~/composables/useToast'
import { formatRemovedToasts } from '~/utils/format-removed-toast'

type MenuData = {
  dishes: Dish[]
  combos: Combo[]
  dishModifiers: Record<string, DishModifierGroup[]>
  dishAddons: Record<string, ClientAddon[]>
}

type ServicesCatalogData = {
  services: ReconcileService[]
}

export function useCartReconciler(menuRef: Ref<MenuData | null>) {
  const cartStore = useCartStore()
  const { warning } = useToast()
  const { data: servicesCatalog } = useNuxtData<ServicesCatalogData>('services-catalog')

  watch(
    () => [!!menuRef.value, !!servicesCatalog.value, cartStore.restored] as const,
    ([menuLoaded, servicesLoaded, restored]) => {
      if (!restored) return

      const menu = menuLoaded ? menuRef.value : null
      const services = servicesLoaded ? (servicesCatalog.value?.services ?? []) : null

      const dishResult = menu && cartStore.dishItems.length > 0
        ? reconcileCart(cartStore.dishItems, {
            dishes: menu.dishes,
            combos: menu.combos,
            dishModifiers: menu.dishModifiers,
            dishAddons: menu.dishAddons,
          })
        : null

      const serviceResult = services !== null && cartStore.serviceItems.length > 0
        ? reconcileServices(cartStore.serviceItems, services)
        : null

      const hasChanges
        = (dishResult && (dishResult.removed.length > 0 || dishResult.updated.length > 0))
        || (serviceResult && (serviceResult.removed.length > 0 || serviceResult.updated.length > 0))
      if (!hasChanges) return

      const reconciledDishes: DishCartItem[] = dishResult
        ? dishResult.items.map((item) => ({ ...item, kind: 'dish' as const }))
        : cartStore.dishItems

      const reconciledServices: ServiceCartItem[] = serviceResult
        ? serviceResult.items.map((item) => ({ ...item, kind: 'service' as const }))
        : cartStore.serviceItems

      // patchByKey вместо replaceAll: сохраняет индексы существующих позиций
      // (и порядок). Открытые модалки useCartEdit, адресующие item по `_key`,
      // не получают stale-индекса.
      cartStore.patchByKey([...reconciledDishes, ...reconciledServices])

      if (dishResult && dishResult.removed.length > 0) {
        for (const toast of formatRemovedToasts(dishResult.removed)) {
          warning(toast.title, toast.description ?? undefined)
        }
      }

      if (dishResult && dishResult.updated.length > 0) {
        warning('Цены блюд изменились', 'Сумма корзины пересчитана')
      }

      if (serviceResult && serviceResult.removed.length > 0) {
        for (const { item, reason } of serviceResult.removed) {
          const msg = reason === 'service_not_bookable'
            ? 'Онлайн-запись отключена'
            : 'Услуга больше недоступна'
          warning(msg, `«${item.serviceName}» убрана из корзины`)
        }
      }

      if (serviceResult && serviceResult.updated.length > 0) {
        warning('Услуги в корзине обновлены', 'Цены, длительность или условия записи изменились')
      }
    },
    { immediate: true },
  )
}
