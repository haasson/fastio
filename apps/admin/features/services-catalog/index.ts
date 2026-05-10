// Public barrel of the services-catalog module.

// API
export * from './api/services'

// Composables
export * from './composables/useServices'
export * from './composables/useServiceSlots'

// components/ — компоненты модуля. Cross-module потребители (appointments, dashboard)
// импортят через ~/features/services-catalog/components/<X>.vue;
// внутри модуля — relative paths.
