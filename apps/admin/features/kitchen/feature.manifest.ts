import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'kitchen',
  vertical: 'retail',
  purpose: 'Кухня: очередь заказов, оверлей сборки, обзор по станциям, настройки',
  tenantModule: true,

  routes: [
    { path: '/kitchen/queue', purpose: 'Очередь блюд для приготовления (KDS-режим)' },
    { path: '/kitchen/assembly', purpose: 'Оверлей сборки заказа: чек-листы по позициям' },
    { path: '/kitchen/overview', purpose: 'Сводный обзор кухни (для менеджера, требует kitchen.overview)' },
    { path: '/kitchen/settings', purpose: 'Группировка станций, тайминги, цвета статусов' },
  ],

  permissions: [
    'kitchen.view',
    'kitchen.cook',
    'kitchen.overview',
  ],

  db: {
    tables: ['kitchen_queue'],
  },

  realtime: [
    { table: 'kitchen_queue', channelComposable: 'useKitchenQueueChannel', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'features.orders',
    'features.tables',
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.plan.useGate',
    'shared.stores.auth',
    'shared.stores.tenant',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
