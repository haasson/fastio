// Public barrel of the menu module.

// API
export * from './api/addons'
export * from './api/categories'
export * from './api/combos'
export * from './api/dishes'
export * from './api/modifiers'

// Composables
export * from './composables/useAddons'
export * from './composables/useCombos'
export * from './composables/useDishCounts'
export * from './composables/useDishSave'
export * from './composables/useDishTable'
export * from './composables/useDishes'
export * from './composables/useModifierGroups'
export * from './composables/useDishModifiersEditor'

// Components (public cross-module API). Внутри модуля — relative paths.
export { default as DishPickerModal } from './components/DishPickerModal.vue'
export type { DishPickerResult } from './components/DishPickerModal.vue'
