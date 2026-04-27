import type { BusinessType, MenuStyle } from '../types/tenant'

export type TagColorPreset = {
  key: string
  color: string
  background: string
}

export const TAG_COLOR_PRESETS: TagColorPreset[] = [
  { key: 'red', color: '#dc2626', background: '#fee2e2' },
  { key: 'orange', color: '#ea580c', background: '#ffedd5' },
  { key: 'amber', color: '#ca8a04', background: '#fef9c3' },
  { key: 'green', color: '#16a34a', background: '#dcfce7' },
  { key: 'emerald', color: '#059669', background: '#d1fae5' },
  { key: 'teal', color: '#0d9488', background: '#ccfbf1' },
  { key: 'cyan', color: '#0891b2', background: '#cffafe' },
  { key: 'blue', color: '#2563eb', background: '#dbeafe' },
  { key: 'indigo', color: '#4f46e5', background: '#e0e7ff' },
  { key: 'violet', color: '#7c3aed', background: '#ede9fe' },
  { key: 'pink', color: '#db2777', background: '#fce7f3' },
  { key: 'rose', color: '#e11d48', background: '#ffe4e6' },
  { key: 'slate', color: '#475569', background: '#f1f5f9' },
  { key: 'primary', color: 'var(--color-primary)', background: 'var(--color-primary-light)' },
]

const MARKETING_ICONS = [
  'Sparkles', 'Star', 'Zap', 'Crown', 'Award', 'ThumbsUp', 'TrendingUp', 'Percent', 'Gift',
] as const

const TIME_ICONS = [
  'Clock', 'Timer', 'CalendarDays', 'Hourglass', 'Sunrise', 'Moon',
] as const

const GENERAL_ICONS = [
  'Tag', 'Bookmark', 'Heart', 'CircleCheck', 'Info', 'Ban',
] as const

const FOOD_ICONS = [
  // Еда и напитки
  'Flame', 'CookingPot', 'Soup', 'Pizza', 'Sandwich', 'Beef', 'Egg', 'Salad', 'IceCream',
  'Fish', 'Shrimp', 'Drumstick', 'Ham', 'Hamburger', 'Bone',
  'Croissant', 'Donut', 'Cookie', 'Cake', 'CakeSlice', 'Popcorn', 'Candy', 'Lollipop',
  'Coffee', 'Wine', 'Beer', 'GlassWater', 'CupSoda', 'Milk', 'BottleWine', 'IceCreamBowl',
  // Диета и здоровье
  'Leaf', 'Vegan', 'Apple', 'Carrot', 'Cherry', 'Grape', 'Citrus', 'Banana', 'Bean',
  'Wheat', 'WheatOff', 'Nut', 'NutOff', 'Sprout', 'HeartPulse', 'Baby', 'ShieldCheck',
  // Характеристики
  'Gauge', 'Dumbbell', 'Scale', 'Ruler', 'Droplets', 'Snowflake', 'Sun', 'AlertTriangle',
] as const

const CATALOG_ICONS = [
  // Товар
  'Package', 'Box', 'ShoppingBag', 'Shirt', 'Gem', 'Watch', 'Glasses', 'Layers',
  // Характеристики
  'Ruler', 'Palette', 'Scale', 'Recycle', 'Leaf', 'Globe', 'ShieldCheck', 'AlertTriangle',
  // Сезон и условия
  'Sun', 'Snowflake', 'Umbrella', 'Thermometer', 'Droplets',
] as const

const SERVICES_ICONS = [
  // Формат работы
  'Laptop', 'Home', 'MapPin', 'Car', 'Plane',
  // Специализация
  'Scissors', 'Wrench', 'Brush', 'Camera', 'Stethoscope', 'GraduationCap', 'Code', 'PenTool', 'Mic', 'Music',
  // Люди
  'User', 'Users', 'UserCheck',
  // Характеристики
  'Gauge', 'Dumbbell', 'ShieldCheck', 'HeartPulse', 'AlertTriangle',
] as const

export type TagIconPreset =
  | typeof MARKETING_ICONS[number]
  | typeof TIME_ICONS[number]
  | typeof GENERAL_ICONS[number]
  | typeof FOOD_ICONS[number]
  | typeof CATALOG_ICONS[number]
  | typeof SERVICES_ICONS[number]

export const getTagIconPresets = (businessType: BusinessType | null, menuStyle: MenuStyle): TagIconPreset[] => {
  const specific = businessType === 'services'
    ? SERVICES_ICONS
    : menuStyle === 'food'
      ? FOOD_ICONS
      : CATALOG_ICONS

  // Set чтобы общие категории (Marketing/Time/General) не дублировали иконки специфичной зоны.
  return [...new Set([...specific, ...MARKETING_ICONS, ...TIME_ICONS, ...GENERAL_ICONS])]
}

export const getTagNamePlaceholder = (businessType: BusinessType | null, menuStyle: MenuStyle): string => {
  if (businessType === 'services') return 'Онлайн'
  if (menuStyle === 'catalog') return 'Новинка'
  return 'Острое'
}

export function getTagColorPreset(key: string): TagColorPreset | undefined {
  return TAG_COLOR_PRESETS.find((p) => p.key === key)
}
