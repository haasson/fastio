import { ref } from 'vue'
import type { DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import { isDishItem, useCartStore, type CartItem } from '../stores/cart'
import type { ModalItem, ClientAddon  } from '~/features/menu-catalog'
import { useMenuStore } from '~/features/menu-catalog'
import { reportError } from '@fastio/shared/observability'

type EditState = {
  open: boolean
  // Адресация item по `_key`, не индексу — после reconcile/patchByKey индекс
  // может стать stale, а `_key` стабилен на всё время жизни позиции.
  key: string | null
  item: ModalItem | null
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  initialQuantity: number
  initialRemovedIngredients: string[]
  initialModifiers: OrderItemModifier[]
  initialAddonIds: string[]
  maxAddons: number | null
}

export function useCartEdit() {
  const cart = useCartStore()
  const menu = useMenuStore()

  const editKey = ref(0)
  const editState = ref<EditState>({
    open: false,
    key: null,
    item: null,
    modifiers: [],
    addons: [],
    initialQuantity: 1,
    initialRemovedIngredients: [],
    initialModifiers: [],
    initialAddonIds: [],
    maxAddons: null,
  })

  function openEdit(index: number) {
    const cartItem = cart.items[index]
    if (!cartItem) return
    if (!isDishItem(cartItem)) {
      reportError(new Error(`[useCartEdit] non-dish item at index ${index}, kind=${cartItem.kind}`))
      return
    }
    if (!cartItem.dishId) return

    const dish = menu.allDishes.find((d) => d.id === cartItem.dishId)
    if (!dish) return

    editKey.value++
    editState.value = {
      open: true,
      key: cartItem._key,
      item: {
        id: dish.id,
        name: dish.name,
        description: dish.description ?? '',
        price: dish.price,
        photos: dish.photos ?? [],
        categoryName: null,
        ingredients: dish.ingredients,
        nutrition: dish.nutrition,
      },
      modifiers: menu.dishModifiers[dish.id] ?? [],
      addons: menu.dishAddons[dish.id] ?? [],
      initialQuantity: cartItem.quantity,
      initialRemovedIngredients: cartItem.removedIngredients ?? [],
      initialModifiers: cartItem.modifiers ?? [],
      initialAddonIds: (cartItem.addons ?? []).map((a) => a.addonId),
      maxAddons: dish.maxAddons ?? menu.maxAddonsDefault,
    }
  }

  function onItemEdited(newItem: CartItem) {
    const key = editState.value.key
    if (!key) {
      reportError(new Error('[useCartEdit] onItemEdited called without key'))
      return
    }
    const idx = cart.items.findIndex((i) => i._key === key)
    if (idx === -1) {
      reportError(new Error(`[useCartEdit] item with _key=${key} not found at edit time`))
      return
    }
    cart.replace(idx, newItem)
  }

  return { editKey, editState, openEdit, onItemEdited }
}
