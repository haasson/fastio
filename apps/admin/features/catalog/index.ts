// Public barrel of the catalog module.
// Универсальные категории/тэги — используются и menu, и services-catalog.

// API
export * from './api/tags'

// Composables
export * from './composables/useCategories'
export * from './composables/useTags'
export * from './composables/useTagDisplay'

// components/ — формы категорий/тэгов и универсальные form/-секции;
// импортятся через ~/features/catalog/components/<X>.vue.
