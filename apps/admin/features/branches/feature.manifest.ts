import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'branches',
  vertical: 'shared',
  purpose: 'Филиалы тенанта: CRUD, переключение текущего, настройки рабочих часов',
  tenantModule: true,

  routes: [
    { path: '/branches', purpose: 'Список филиалов + создание' },
    { path: '/branches/settings', purpose: 'Настройки конкретного филиала (часы, контакты)' },
  ],

  permissions: [
    'settings.view',
    'settings.edit',
  ],

  db: {
    tables: [
      'branches',
      'order_statuses',
      'orders',
    ],
    // useBranches/useBranch также читают `orders` и `order_statuses` для счётчиков по филиалу
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.stores.branch',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
