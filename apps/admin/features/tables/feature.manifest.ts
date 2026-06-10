import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'dineIn',
  vertical: 'retail',
  purpose: 'Столы и вызовы официанта (in-restaurant ordering). Управляет toggleable модулем dineIn',
  tenantModule: true,

  routes: [
    { path: '/tables/list', purpose: 'Список столов с QR-кодами и зонами' },
    { path: '/tables/layout', purpose: 'Визуальный layout зала (расстановка столов)' },
    { path: '/tables/reservations', purpose: 'Брони столов: все статусы, фильтр, пагинация (tables.view)' },
    { path: '/tables/settings', purpose: 'Настройки столов и онлайн-брони: вызов официанта, отображение, слоты/гости (settings.edit)' },
  ],

  permissions: [
    'tables.view',
    'tables.manage',
    'settings.edit',
  ],

  db: {
    tables: ['orders', 'order_items', 'reservation_settings', 'reservations', 'table_call_types', 'table_calls', 'table_settings', 'tables'],
    rpc: ['open_table_check', 'add_items_to_check', 'settle_table_check'],
  },

  realtime: [
    { table: 'tables', channelComposable: 'useTablesChannel', events: ['insert', 'update', 'delete'] },
    { table: 'table_calls', channelComposable: 'useTableCallsChannel', events: ['insert', 'update'] },
  ],

  dependsOn: [
    'features.kitchen',
    'features.menu',
    'features.orders',
    'features.reservations',
    'shared.composables.useTableUrl',
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.plan.useGate',
    'shared.stores.auth',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.utils.alerts',
    'shared.utils.query',
    'shared.utils.renderQr',
    '@fastio/shared',
  ],
})
