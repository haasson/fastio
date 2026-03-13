export type ModifierGroup = {
  id: string
  tenantId: string
  name: string
  sortOrder: number
  active: boolean
  options: ModifierOption[]
}

export type ModifierOption = {
  id: string
  groupId: string
  name: string
  sortOrder: number
  active: boolean
}

export type DishModifierOption = {
  optionId: string
  optionName: string
  groupId: string
  groupName: string
  priceDelta: number
  isDefault: boolean
  sortOrder: number
}

export type DishModifierGroup = {
  groupId: string
  groupName: string
  sortOrder: number
  options: DishModifierOption[]
}

export type OrderItemModifier = {
  optionId?: string
  groupName: string
  optionName: string
  priceDelta: number
}

export type ModifierGroupFormData = {
  name: string
  active: boolean
  options: { id?: string; name: string; active: boolean }[]
}
