// Public barrel of the catalog module.
// Универсальные категории/тэги — используются и menu, и services-catalog.

// API
export * from './api/tags'

// Composables
export * from './composables/useCategories'
export * from './composables/useTags'
export * from './composables/useTagDisplay'

// Components (public cross-module API). Универсальные form/-секции и
// карточка предмета каталога — используются и menu, и services-catalog.
export { default as ItemCard } from './components/ItemCard.vue'
export { default as BasicInfoSection } from './components/form/BasicInfoSection.vue'
export { default as TagsSection } from './components/form/TagsSection.vue'
