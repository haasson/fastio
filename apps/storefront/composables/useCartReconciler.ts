import { useNuxtData } from 'nuxt/app'
import { reconcileCart } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { useToast } from '~/composables/useToast'
import { formatRemovedToasts } from '~/utils/format-removed-toast'

export async function reconcileCartItems() {
  const cartStore = useCartStore()
  const menuStore = useMenuStore()
  const { warning } = useToast()

  if (cartStore.items.length === 0) return

  // Ensure menu is loaded (may not be on /cart page)
  if (menuStore.allDishes.length === 0) {
    const { data } = useNuxtData('menu')
    if (!data.value) {
      data.value = await $fetch('/api/menu')
    }
  }

  if (menuStore.allDishes.length === 0) return

  const result = reconcileCart(cartStore.items, {
    dishes: menuStore.allDishes,
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
}
