export type CategoryType = 'regular' | 'combo'
export type SpecialCategoryType = 'combo'

export const SPECIAL_CATEGORY_TYPES: SpecialCategoryType[] = ['combo']

export const CATEGORY_TYPE_LABELS: Record<SpecialCategoryType, string> = {
  combo: 'Комбо',
}

export type DishTagDefinition = {
  id: string
  tenantId: string
  name: string
  icon: string
  color: string
  sortOrder: number
}

export type DishNutrition = {
  calories: number
  protein: number
  fat: number
  carbs: number
  weight: number
}

export type DishIngredient = {
  name: string
  removable: boolean
}

export type Category = {
  id: string
  tenantId: string
  name: string
  type: CategoryType
  tagId: string | null
  order: number
  active: boolean
  photoUrl: string | null
  useFirstDishPhoto: boolean
}

export type CategoryData = Partial<Pick<Category, 'name' | 'active' | 'order' | 'photoUrl' | 'useFirstDishPhoto' | 'tagId'>>

export type Dish = {
  id: string
  tenantId: string
  categoryId: string
  name: string
  description: string
  price: number
  photos: string[]
  ingredients: DishIngredient[]
  nutrition: DishNutrition | null
  weightUnit: 'г' | 'мл'
  tags: string[]
  active: boolean
  order: number
  requiresKitchen: boolean
}

export type ComboItem = {
  id: string
  comboId: string
  dishId: string
  order: number
}

export type ComboItemInput = {
  dishId: string
  modifierOptionIds: string[]
}

export type Combo = {
  id: string
  tenantId: string
  categoryId: string
  name: string
  description: string
  price: number
  photos: string[]
  tags: string[]
  active: boolean
  order: number
}

export type ComboFormData = {
  name: string
  description: string
  price: number
  photos: string[]
  tags: string[]
  active: boolean
  items: ComboItemInput[]
}
