import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'branch',
  vertical: 'shared',
  purpose: 'Выбор филиала гостем: store с persisted id + smart-switcher (валидирует совместимость корзины) + UI компоненты',

  routes: [
    // Selection через модалку из header'а — отдельной страницы нет.
  ],

  db: {
    // Прямого supabase.from() нет — список филиалов приходит через /api/branches.
    tables: [],
  },

  dependsOn: [
    'features.cart',                 // useCartReconciler для smart-reset + computeBranchCompat для validation
    'features.menu-catalog',         // dish.branchIds lookup
    'features.services-catalog',     // service+resource.branchIds lookup
    'shared.composables.useToast',
    '@fastio/shared',                // type Branch
    'server.api.branches',
  ],
})
