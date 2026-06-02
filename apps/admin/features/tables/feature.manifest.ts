import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'dineIn',
  vertical: 'retail',
  purpose: 'Столы и вызовы официанта (in-restaurant ordering). Управляет toggleable модулем dineIn',
  tenantModule: true,

  routes: [
    { path: '/tables/list', purpose: 'Список столов с QR-кодами и зонами' },
    { path: '/tables/layout', purpose: 'Визуальный layout зала (расстановка столов)' },
    { path: '/tables/calls', purpose: 'Лента активных вызовов официанта' },
    { path: '/tables/settings', purpose: 'Настройки столов: вызов официанта, отображение зала, типы вызовов (tables.manage)' },
  ],

  permissions: [
    'tables.view',
    'tables.manage',
  ],

  db: {
    tables: ['orders', 'table_call_types', 'table_calls', 'table_settings', 'tables'],
    rpc: ['apply_table_discount'],
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
