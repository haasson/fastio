export type DishTag = 'spicy' | 'vegetarian' | 'vegan' | 'new' | 'popular' | 'hit'

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
  order: number
  active: boolean
  photoUrl: string | null
  useFirstDishPhoto: boolean
}

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
}
