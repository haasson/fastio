import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'dineIn',
  vertical: 'retail',
  purpose: 'Столы и вызовы официанта (in-restaurant ordering). Управляет toggleable модулем dineIn',
  tenantModule: true,

  routes: [
    { path: '/tables/list', purpose: 'Список столов с QR-кодами и зонами' },
    { path: '/tables/layout', purpose: 'Визуальный layout зала (расстановка столов)' },
    { path: '/tables/calls', purpose: 'История и активные вызовы официанта' },
  ],

  permissions: [
    'tables.view',
    'tables.manage',
  ],

  db: {
    tables: [
      'tables',
      'table_calls',
      'table_call_types',
      // tables.api также пишет в orders при добавлении блюда в стол — компромисс по дизайну
      'orders',
    ],
  },

  realtime: [
    { table: 'table_calls', channelComposable: 'useTableCallsChannel', events: ['insert', 'update'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.stores.tenant',
    'shared.stores.branch',
    'shared.utils.query',
    'features.menu',
    'features.orders',
    '@fastio/shared',
  ],
})
