import { watch } from 'vue'
import { reconcileCart } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useToast } from '~/composables/useToast'
import { formatRemovedToast } from '~/utils/format-removed-toast'

export function useCartReconciler() {
  const cartStore = useCartStore()
  const menuStore = useMenuStore()
  const { warning } = useToast()

  watch(
    () => [menuStore.allDishes.length, cartStore.restored] as const,
    ([dishCount, restored]) => {
      if (!restored) return
      if (dishCount === 0) return
      if (cartStore.items.length === 0) return

      const result = reconcileCart(cartStore.items, {
        dishes: menuStore.allDishes,
        dishModifiers: menuStore.dishModifiers,
        dishAddons: menuStore.dishAddons,
      })

      const hasChanges = result.removed.length > 0 || result.updated.length > 0
      if (!hasChanges) return

      // Update cart via store method
      cartStore.replaceAll(result.items)

      // Show notifications
      if (result.removed.length > 0) {
        const names = result.removed.map(i => i.dishName)
        const description = formatRemovedToast(names)
        warning('Убрано из корзины', description ?? undefined)
      }

      if (result.updated.length > 0) {
        warning('Цены обновлены', 'Некоторые цены в корзине изменились')
      }
    },
    { immediate: true },
  )
}
