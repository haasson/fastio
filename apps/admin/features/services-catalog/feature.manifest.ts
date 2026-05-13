import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'services-catalog',
  vertical: 'services',
  purpose: 'Каталог услуг: категории, услуги, теги, привязка к ресурсам/филиалам',
  // Не отдельный TenantModule — гейтится через TenantModules.services
  tenantModule: false,

  routes: [
    { path: '/services/categories', purpose: 'Категории услуг' },
    { path: '/services/items', purpose: 'Сами услуги (CRUD)' },
    { path: '/services/tags', purpose: 'Теги услуг' },
    { path: '/services/settings', purpose: 'Общие настройки каталога услуг' },
  ],

  // Услуги используют общие menu.* permissions (каталог — один концепт)
  permissions: [
    'menu.view',
    'menu.edit',
    'menu.delete',
  ],

  db: {
    tables: [
      'service_branches',
      'services',
    ],
    rpc: ['services_set_branch_ids'],
  },

  // Realtime — через useServices (на useRealtimeList)
  realtime: [
    { table: 'services', channelComposable: 'useServices', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'features.appointments',
    'features.branches',
    'features.catalog',
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.useItemManager',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.imageOptimize',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
