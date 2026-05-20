// Public barrel of the tables module.

// API
export * from './api/tables'
export * from './api/table-calls'

// Composables
export * from './composables/useTablesContext'
export * from './composables/useTableCallsChannel'
export * from './composables/useTableCallAlertHandler'
export * from './composables/useAddDishToTable'

// Utils
// generateTableQrPdf НЕ ре-экспортится из barrel — это lazy утилка с
// dynamic-import jspdf. Импортируется напрямую из TableQrModal.vue.
