/** Дефолтная длительность триала. Используется как fallback если billing_config недоступен. */
export const DEFAULT_TRIAL_DAYS = 14

/**
 * Палитра, из которой пользователь выбирает цвет филиала. Первый элемент —
 * дефолт для новой формы (более «живой», чем DEFAULT_BRANCH_COLOR).
 */
export const BRANCH_COLOR_PRESETS: string[] = [
  '#FF5500',
  '#FFA500',
  '#00C853',
  '#2979FF',
  '#AA00FF',
  '#E91E63',
  '#795548',
]

/** Дефолтный цвет для нового филиала (используется в OnboardingStepBranch до показа палитры). */
export const DEFAULT_BRANCH_COLOR = BRANCH_COLOR_PRESETS[0]

/** Палитра для полигонов зон доставки — насыщенные, хорошо различимые на карте. */
export const DELIVERY_ZONE_COLOR_PRESETS: string[] = [
  '#FF5500',
  '#2979FF',
  '#00C853',
  '#FFA500',
  '#AA00FF',
  '#E91E63',
  '#00BCD4',
  '#795548',
]

export const DEFAULT_DELIVERY_ZONE_COLOR = DELIVERY_ZONE_COLOR_PRESETS[0]
