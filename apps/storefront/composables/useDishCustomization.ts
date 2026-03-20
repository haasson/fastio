import { ref, reactive, computed } from 'vue'
import type { Dish, DishModifierGroup, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'

export type ComboItemInfo = {
  name: string
  photo: string | null
  modifier: string | null
}

export type ModalItem = {
  id: string
  name: string
  description: string
  price: number
  photos: string[]
  categoryName?: string | null
  ingredients?: Dish['ingredients']
  nutrition?: Dish['nutrition']
  comboId?: string
  comboItems?: ComboItemInfo[]
}

type UseDishCustomizationProps = {
  item: ModalItem
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  currency?: string
  initialQuantity?: number
  initialRemovedIngredients?: string[]
  initialModifiers?: OrderItemModifier[]
  initialAddonIds?: string[]
}

export function useDishCustomization(props: UseDishCustomizationProps) {
  const currency = props.currency ?? '₽'

  // --- State ---
  const quantity = ref(props.initialQuantity ?? 1)
  const removedSet = ref(new Set<string>(props.initialRemovedIngredients ?? []))

  // modifiers: groupId → selected optionId
  const selectedModifiers = reactive<Record<string, string>>({})

  // Init modifiers: prefer initialModifiers, fall back to defaults
  for (const group of props.modifiers) {
    let matchedOptionId: string | undefined

    if (props.initialModifiers?.length) {
      const initMod = props.initialModifiers.find((m) => m.groupName === group.groupName)
      if (initMod) {
        const option = group.options.find(
          (o) => (initMod.optionId && o.optionId === initMod.optionId) || o.optionName === initMod.optionName,
        )
        if (option) matchedOptionId = option.optionId
      }
    }

    if (!matchedOptionId) {
      const defaultOpt = group.options.find((o) => o.isDefault) ?? group.options[0]
      if (defaultOpt) matchedOptionId = defaultOpt.optionId
    }

    if (matchedOptionId) selectedModifiers[group.groupId] = matchedOptionId
  }

  const selectedAddonIds = ref(new Set<string>(props.initialAddonIds ?? []))

  // --- Computed ---

  const removableIngredients = computed(() =>
    (props.item.ingredients ?? []).filter((i) => i.removable),
  )

  const selectedModifierOptions = computed<OrderItemModifier[]>(() => {
    const result: OrderItemModifier[] = []
    for (const group of props.modifiers) {
      const selectedId = selectedModifiers[group.groupId]
      const option = group.options.find((o) => o.optionId === selectedId)
      if (option) {
        result.push({
          optionId: option.optionId,
          groupName: group.groupName,
          optionName: option.optionName,
          priceDelta: option.priceDelta,
        })
      }
    }
    return result
  })

  const selectedAddonsList = computed<OrderItemAddon[]>(() =>
    props.addons
      .filter((a) => selectedAddonIds.value.has(a.id))
      .map((a) => ({ addonId: a.id, addonName: a.name, price: a.price })),
  )

  const unitPrice = computed(() => {
    let price = props.item.price
    price += selectedModifierOptions.value.reduce((s, m) => s + m.priceDelta, 0)
    price += selectedAddonsList.value.reduce((s, a) => s + a.price, 0)
    return price
  })

  const totalPrice = computed(() => unitPrice.value * quantity.value)

  // --- Methods ---

  function selectModifier(groupId: string, optionId: string) {
    selectedModifiers[groupId] = optionId
  }

  function buildCartItem(): CartItem {
    return {
      dishId: props.item.comboId ? null : props.item.id,
      comboId: props.item.comboId ?? null,
      dishName: props.item.name,
      categoryName: props.item.categoryName ?? null,
      price: props.item.price,
      quantity: quantity.value,
      removedIngredients: [...removedSet.value],
      modifiers: selectedModifierOptions.value,
      addons: selectedAddonsList.value,
      photo: props.item.photos[0] ?? null,
    }
  }

  return {
    // State
    quantity,
    removedSet,
    selectedModifiers,
    selectedAddonIds,

    // Computed
    removableIngredients,
    selectedModifierOptions,
    selectedAddonsList,
    unitPrice,
    totalPrice,
    currency,

    // Methods
    selectModifier,
    buildCartItem,
  }
}
