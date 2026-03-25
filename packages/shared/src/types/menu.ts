export type DishTag = 'spicy' | 'vegetarian' | 'vegan' | 'new' | 'popular' | 'hit'

export type CategoryType = 'regular' | 'combo' | 'new' | 'hit'
export type SpecialCategoryType = Exclude<CategoryType, 'regular'>
export type VirtualCategoryType = 'new' | 'hit'

export const SPECIAL_CATEGORY_TYPES: SpecialCategoryType[] = ['combo', 'new', 'hit']
export const VIRTUAL_CATEGORY_TYPES: VirtualCategoryType[] = ['new', 'hit']

export const CATEGORY_TYPE_LABELS: Record<SpecialCategoryType, string> = {
  combo: 'Комбо',
  new: 'Новинки',
  hit: 'Популярное',
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
  order: number
  active: boolean
  photoUrl: string | null
  useFirstDishPhoto: boolean
}

export type CategoryData = Partial<Pick<Category, 'name' | 'active' | 'order' | 'photoUrl' | 'useFirstDishPhoto'>>

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
  tags: DishTag[]
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
  tags: DishTag[]
  active: boolean
  order: number
}

export type ComboFormData = {
  name: string
  description: string
  price: number
  photos: string[]
  tags: DishTag[]
  active: boolean
  items: ComboItemInput[]
}
