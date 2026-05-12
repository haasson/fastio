import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'audit-log',
  vertical: 'shared',
  purpose: 'Журнал аудита: кто/что/когда сделал. Append-only лог действий в админке',
  tenantModule: false,

  routes: [
    { path: '/audit-log', purpose: 'Журнал действий с фильтрами по сущностям/пользователям/датам' },
  ],

  permissions: [
    'audit_log.view',
  ],

  db: {
    tables: ['audit_logs'],
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.utils.featureFlags',
    '@fastio/shared',
  ],
})
