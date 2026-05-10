// Public barrel of the settings module.

// API
export * from './api/module-configs'

// Composables
export * from './composables/useNotificationPrefs'

// components/ — модальные/inline-блоки настроек тенанта (модули, биллинг,
// филиалы, доставка, роли, контакты, рабочие часы). Cross-module потребители
// импортят через ~/features/settings/components/<X>.vue.
