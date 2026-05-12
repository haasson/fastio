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
    'shared.stores.tenant',
    'shared.data.useDatabase',
    '@fastio/shared',
  ],
})
