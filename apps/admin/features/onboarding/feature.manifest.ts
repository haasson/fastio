import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'onboarding',
  vertical: 'shared',
  purpose: 'Онбординг нового тенанта: wizard, чек-листы первичной настройки, контекстные подсказки',
  tenantModule: false,

  routes: [
    // Онбординг — это overlay/wizard, его UI рендерится поверх обычных страниц
    // через layout, отдельных pages не имеет.
  ],

  // permissions: intentionally empty — онбординг рендерится для владельца тенанта (по сути, единственная роль на этом этапе)
  permissions: [],

  db: {
    tables: [],
    // Состояние онбординга хранится в tenants.onboarding_state (jsonb)
  },

  dependsOn: [
    'features.branches',
    'features.help',
    'features.legal',
    'shared.composables.delivery.useDadataSuggestions',
    'shared.composables.useStorefrontUrl',
    'shared.plan.useBillingConfig',
    'shared.plan.useGate',
    'shared.plan.usePlans',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.AddressSuggestInput',
    'shared.utils.planFeatureLabels',
    '@fastio/shared',
  ],
})
