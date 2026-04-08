export type ModifierGroup = {
  id: string
  tenantId: string
  name: string
  sortOrder: number
  active: boolean
  affectsWeight: boolean
  weightMode: 'global' | 'per_dish'
  options: ModifierOption[]
}

export type ModifierOption = {
  id: string
  groupId: string
  name: string
  sortOrder: number
  active: boolean
  weight: number | null
}

export type DishModifierOption = {
  optionId: string
  optionName: string
  groupId: string
  groupName: string
  priceDelta: number
  weight: number | null
  isDefault: boolean
  sortOrder: number
  active: boolean
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
  affectsWeight: boolean
  weightMode: 'global' | 'per_dish'
  options: { id?: string; name: string; active: boolean; weight?: number | null }[]
}
