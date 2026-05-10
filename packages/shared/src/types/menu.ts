export type CategoryType = 'regular' | 'combo'
export type SpecialCategoryType = 'combo'
export type CategoryKind = 'food' | 'service'

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
}

export type Category = {
  id: string
  tenantId: string
  name: string
  slug: string | null
  type: CategoryType
  kind: CategoryKind
  tagId: string | null
  order: number
  active: boolean
  photoUrl: string | null
  useFirstDishPhoto: boolean
  color: string | null
}

export const isAutoCategory = (cat: Category): boolean => cat.tagId !== null

export type CategoryData = Partial<Pick<Category, 'name' | 'active' | 'order' | 'photoUrl' | 'useFirstDishPhoto' | 'tagId' | 'slug' | 'color'>>

export type Dish = {
  id: string
  tenantId: string
  categoryId: string
  name: string
  description: string
  longDescription: string | null
  price: number
  photos: string[]
  ingredients: DishIngredient[]
  nutrition: DishNutrition | null
  weightUnit: 'г' | 'мл'
  tags: string[]
  active: boolean
  order: number
  requiresKitchen: boolean
  maxAddons: number | null
  branchIds: string[]
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
  addonIds?: string[]
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
  branchIds: string[]
}

export type ComboFormData = {
  name: string
  description: string
  price: number
  photos: string[]
  tags: string[]
  active: boolean
  items: ComboItemInput[]
  branchIds: string[]
}
