import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'catalog',
  vertical: 'shared',
  purpose: 'Универсальный «каталог»: общие категории и теги для menu и services-catalog. Cross-vertical UI-компоненты карточки/формы предмета',
  tenantModule: false,

  routes: [
    // Каталог не имеет своих страниц — экспортирует cross-module UI/composables
    // для menu и services-catalog. Свои разделы у тех фич.
  ],

  permissions: [
    'menu.view',
    'menu.edit',
  ],

  db: {
    tables: [
      'dish_tags',
      'dish_tag_assignments',
      'combo_tag_assignments',
    ],
  },

  dependsOn: [
    'features.legal',
    'shared.composables.useItemVariant',
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.plan.useGate',
    'shared.stores.tenant',
    'shared.ui.components.ColorSwatch',
    'shared.ui.components.ImageUploadTrigger',
    'shared.ui.composables.useItemManager',
    'shared.utils.query',
    '@fastio/shared',
  ],
  realtime: [
    { table: 'categories', channelComposable: 'useCategories', events: ['insert', 'update', 'delete'] },
  ],
})
