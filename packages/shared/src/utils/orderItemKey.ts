import type { OrderItemModifier } from '../types/modifier'
import type { OrderItemAddon } from '../types/order'

export const orderItemKey = (
  modifiers: OrderItemModifier[],
  addons: OrderItemAddon[],
  removedIngredients: string[],
): string => [
  modifiers.map((m) => m.optionName).sort().join(','),
  addons.map((a) => a.addonName).sort().join(','),
  [...removedIngredients].sort().join(','),
].join('|')
