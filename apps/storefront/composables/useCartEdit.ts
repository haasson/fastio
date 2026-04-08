import { ref } from 'vue'
import type { DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import type { ModalItem } from '~/composables/useDishCustomization'
import type { ClientAddon } from '~/stores/menu'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'

type EditState = {
  open: boolean
  index: number
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
    index: -1,
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
    if (!cartItem.dishId) return

    const dish = menu.allDishes.find((d) => d.id === cartItem.dishId)
    if (!dish) return

    editKey.value++
    editState.value = {
      open: true,
      index,
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
    cart.replace(editState.value.index, newItem)
  }

  return { editKey, editState, openEdit, onItemEdited }
}
