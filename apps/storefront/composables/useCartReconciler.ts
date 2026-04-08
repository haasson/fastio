import { watch } from 'vue'
import { reconcileCart } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useToast } from '~/composables/useToast'
import { formatRemovedToasts } from '~/utils/format-removed-toast'

export function useCartReconciler() {
  const cartStore = useCartStore()
  const menuStore = useMenuStore()
  const { warning } = useToast()

  watch(
    () => [menuStore.allDishes.length, menuStore.allCombos.length, cartStore.restored] as const,
    ([dishCount, comboCount, restored]) => {
      if (!restored) return
      if (dishCount === 0 && comboCount === 0) return
      if (cartStore.items.length === 0) return

      const result = reconcileCart(cartStore.items, {
        dishes: menuStore.allDishes,
        combos: menuStore.allCombos,
        dishModifiers: menuStore.dishModifiers,
        dishAddons: menuStore.dishAddons,
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
        warning('Цены обновлены', 'Некоторые цены в корзине изменились')
      }
    },
    { immediate: true },
  )
}
