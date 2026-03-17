export type DishTag = 'spicy' | 'vegetarian' | 'vegan' | 'new' | 'popular' | 'hit'

export type DishTagConfig = {
  label: string
  icon: string       // имя иконки из lucide
  color: string      // CSS цвет текста
  background: string // CSS цвет фона
}

export const DISH_TAGS: Record<DishTag, DishTagConfig> = {
  spicy: {
    label: 'Острое',
    icon: 'Flame',
    color: '#dc2626',
    background: '#fee2e2',
  },
  vegetarian: {
    label: 'Вегетарианское',
    icon: 'Leaf',
    color: '#16a34a',
    background: '#dcfce7',
  },
  vegan: {
    label: 'Веган',
    icon: 'Leaf',
    color: '#16a34a',
    background: '#dcfce7',
  },
  new: {
    label: 'Новинка',
    icon: 'Sparkles',
    color: 'var(--on-primary)',
    background: 'var(--primary)',
  },
  popular: {
    label: 'Популярное',
    icon: 'Star',
    color: '#ca8a04',
    background: '#fef9c3',
  },
  hit: {
    label: 'Хит',
    icon: 'Zap',
    color: '#ca8a04',
    background: '#fef9c3',
  },
}

export const DISH_TAG_LIST = Object.keys(DISH_TAGS) as DishTag[]

export function getDishTagConfig(tag: string): DishTagConfig | null {
  return DISH_TAGS[tag as DishTag] ?? null
}
