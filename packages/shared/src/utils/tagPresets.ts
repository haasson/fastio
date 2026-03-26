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

export const TAG_ICON_PRESETS = [
  // Еда и напитки
  'Flame', 'CookingPot', 'Soup', 'Pizza', 'Sandwich', 'Beef', 'Egg', 'Salad', 'IceCream',
  'Fish', 'Shrimp', 'Drumstick', 'Ham', 'Hamburger', 'Bone',
  'Croissant', 'Donut', 'Cookie', 'Cake', 'CakeSlice', 'Popcorn', 'Candy', 'Lollipop',
  'Coffee', 'Wine', 'Beer', 'GlassWater', 'CupSoda', 'Milk', 'BottleWine', 'IceCreamBowl',
  // Диета и здоровье
  'Leaf', 'Vegan', 'Apple', 'Carrot', 'Cherry', 'Grape', 'Citrus', 'Banana', 'Bean',
  'Wheat', 'WheatOff', 'Nut', 'NutOff', 'Sprout', 'HeartPulse', 'Baby', 'ShieldCheck',
  // Маркетинг
  'Sparkles', 'Star', 'Zap', 'Crown', 'Award', 'ThumbsUp', 'TrendingUp', 'Percent', 'Gift',
  // Время и статус
  'Clock', 'Timer', 'CalendarDays', 'Hourglass', 'Sunrise', 'Moon',
  // Характеристики
  'Gauge', 'Dumbbell', 'Scale', 'Ruler', 'Droplets', 'Snowflake', 'Sun', 'AlertTriangle',
  // Общие
  'Tag', 'Bookmark', 'Heart', 'CircleCheck', 'Info', 'Ban',
] as const

export type TagIconPreset = typeof TAG_ICON_PRESETS[number]

export function getTagColorPreset(key: string): TagColorPreset | undefined {
  return TAG_COLOR_PRESETS.find((p) => p.key === key)
}
