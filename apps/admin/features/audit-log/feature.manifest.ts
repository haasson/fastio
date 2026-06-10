import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'audit-log',
  vertical: 'shared',
  purpose: 'Единый журнал действий: append-only аудит конфигурации (БД-триггеры) + события заказов в одной ленте',
  tenantModule: false,

  routes: [
    { path: '/audit-log', purpose: 'Журнал действий: keyset-лента audit+order событий, фильтры по действию/объекту, скоуп по филиалу, поиск' },
  ],

  permissions: [
    'audit_log.view',
  ],

  db: {
    // audit_logs — чтение напрямую; order_events/orders — только через RPC journal_events()
    tables: ['audit_logs', 'order_events', 'orders'],
    rpc: ['journal_events'],
  },

  dependsOn: [
    'features.orders',
    'shared.composables.usePageTitle',
    'shared.data.useDatabase',
    'shared.plan.useGate',
    'shared.stores.auth',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.utils.featureFlags',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
