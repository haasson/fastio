import { watch } from 'vue'
import type { Ref } from 'vue'
import { reconcileCart } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'
import { useToast } from '~/composables/useToast'
import { formatRemovedToasts } from '~/utils/format-removed-toast'
import type { Dish, Combo, DishModifierGroup } from '@fastio/shared'

type MenuData = {
  dishes: Dish[]
  combos: Combo[]
  dishModifiers: Record<string, DishModifierGroup[]>
  dishAddons: Record<string, ClientAddon[]>
}

export function useCartReconciler(menuRef: Ref<MenuData | null>) {
  const cartStore = useCartStore()
  const { warning } = useToast()

  watch(
    () => [!!menuRef.value, cartStore.restored] as const,
    ([menuLoaded, restored]) => {
      if (!restored) return
      if (!menuLoaded) return
      if (cartStore.items.length === 0) return

      const menu = menuRef.value!
      const result = reconcileCart(cartStore.items, {
        dishes: menu.dishes,
        combos: menu.combos,
        dishModifiers: menu.dishModifiers,
        dishAddons: menu.dishAddons,
      })

      const hasChanges = result.removed.length > 0 || result.updated.length > 0
      if (!hasChanges) return

      cartStore.replaceAll(result.items)

      if (result.removed.length > 0) {
        for (const toast of formatRemovedToasts(result.removed)) {
          warning(toast.title, toast.description ?? undefined)
        }
      }

      if (result.updated.length > 0) {
        warning('Цены блюд изменились', 'Сумма корзины пересчитана')
      }
    },
    { immediate: true },
  )
}
