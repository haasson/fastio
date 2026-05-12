import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'legal',
  vertical: 'shared',
  purpose: 'Юридические страницы FastIO: оферта, политика конфиденциальности (статика + согласие пользователя)',
  tenantModule: false,

  routes: [
    { path: '/legal/oferta', purpose: 'Публичная оферта FastIO' },
    { path: '/legal/privacy', purpose: 'Политика конфиденциальности FastIO' },
  ],

  // permissions: intentionally empty — публичная статика + согласие тенанта (не RBAC)
  permissions: [],

  db: {
    tables: [],
    // Согласие на оферту хранится в tenants.legal_agreed_at — мутируется через tenantStore
  },

  dependsOn: [
    'shared.stores.tenant',
  ],
})
