// Public barrel of the table-mode module.
// Режим стола (QR-меню в заведении): отображение чека гостя в реальном времени.

export { useTableStore, type CheckItem } from './stores/table'
export { useTableRealtime } from './composables/useTableRealtime'
export { default as CallWaiterButton } from './components/CallWaiterButton.vue'
