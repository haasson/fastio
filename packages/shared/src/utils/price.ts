export const getItemUnitPrice = (item: {
  price: number
  modifiers?: { priceDelta: number }[]
  addons?: { price: number }[]
}) =>
  item.price
  + (item.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
  + (item.addons?.reduce((s, a) => s + a.price, 0) ?? 0)

export function getItemSummary(item: {
  modifiers?: { optionName: string }[]
  addons?: { addonName: string }[]
  removedIngredients?: string[]
}): string {
  const parts: string[] = []
  if (item.modifiers?.length) {
    parts.push(...item.modifiers.map(m => m.optionName))
  }
  if (item.addons?.length) {
    parts.push(...item.addons.map(a => `+ ${a.addonName}`))
  }
  if (item.removedIngredients?.length) {
    parts.push(`Убрать: ${item.removedIngredients.join(', ')}`)
  }
  return parts.join(' · ')
}
