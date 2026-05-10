// Public barrel of the menu module.

// API
export * from './api/categories'
export * from './api/combos'
export * from './api/dishes'
export * from './api/modifiers'

// Composables
export * from './composables/useCombos'
export * from './composables/useDishCounts'
export * from './composables/useDishSave'
export * from './composables/useDishTable'
export * from './composables/useDishes'
export * from './composables/useModifierGroups'
export * from './composables/useDishModifiersEditor'

// components/ — компоненты модуля. Cross-module потребители (orders, promotions, tables)
// импортят DishPickerModal через ~/features/menu/components/DishPickerModal.vue;
// внутри модуля — relative paths.
