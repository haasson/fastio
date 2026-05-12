import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'billing',
  vertical: 'shared',
  purpose: 'Биллинг тенанта: текущий план, история транзакций, оплата, апгрейды',
  tenantModule: false,

  routes: [
    { path: '/account/billing', purpose: 'Кабинет биллинга: статус плана, транзакции, апгрейд' },
  ],

  permissions: [
    'billing.manage',
  ],

  db: {
    tables: [
      'billing_config',
      'billing_transactions',
      'plans',
    ],
    rpc: ['billing_change_plan'],
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.plan.usePlans',
    'shared.plan.useGate',
    '@fastio/shared',
  ],
})
