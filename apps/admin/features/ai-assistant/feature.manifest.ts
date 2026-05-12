import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'ai-assistant',
  vertical: 'shared',
  purpose: 'AI-ассистент админки: чат с базой знаний, помощь по интерфейсу. Серверная часть — server/ai/*',
  tenantModule: false,

  routes: [
    // Ассистент это виджет/оверлей, не отдельная страница
  ],

  // permissions: intentionally empty — ассистент доступен всем ролям, RBAC-гейтинг не нужен
  permissions: [],

  db: {
    tables: [],
    // История чата хранится клиентски (или в нагрузке on-demand). Серверный контекст — apps/admin/server/ai/*
  },

  dependsOn: [
    'shared.stores.tenant',
    '@fastio/kb',
  ],
})
