import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'menu',
  vertical: 'retail',
  purpose: 'Меню: категории, блюда, модификаторы, аддоны, комбо. Содержит несколько toggleable sub-модулей (modifiers/addons/combos)',
  tenantModule: false,

  routes: [
    { path: '/menu/categories', purpose: 'Категории меню' },
    { path: '/menu/dishes', purpose: 'Блюда (CRUD, поиск, импорт)' },
    { path: '/menu/modifiers', purpose: 'Группы модификаторов и опции' },
    { path: '/menu/addons', purpose: 'Аддоны и пресеты' },
    { path: '/menu/tags', purpose: 'Теги меню' },
  ],

  permissions: [
    'menu.view',
    'menu.edit',
    'menu.delete',
  ],

  db: {
    tables: [
      'addon_preset_items',
      'addon_presets',
      'addons',
      'categories',
      'combo_items',
      'combos',
      'dish_addons',
      'dish_modifier_groups',
      'dish_modifier_options',
      'dishes',
      'modifier_groups',
      'modifier_options',
    ],
    rpc: ['combos_set_branch_ids', 'dishes_set_branch_ids', 'reorder_dishes'],
  },

  realtime: [
    { table: 'dishes', channelComposable: 'useDishes', events: ['insert', 'update', 'delete'] },
    { table: 'addons', channelComposable: 'useAddons', events: ['insert', 'update', 'delete'] },
    { table: 'combos', channelComposable: 'useCombos', events: ['insert', 'update', 'delete'] },
    { table: 'modifier_groups', channelComposable: 'useModifierGroups', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'features.branches',
    'features.catalog',
    'features.legal',
    'features.orders',
    'shared.composables.useItemVariant',
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.plan.useGate',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.DishItemRow',
    'shared.ui.components.HintPopover',
    'shared.ui.composables.useItemManager',
    'shared.utils.filterDefined',
    'shared.utils.imageOptimize',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
