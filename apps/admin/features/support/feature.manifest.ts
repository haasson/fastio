import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'support',
  vertical: 'shared',
  purpose: 'Поддержка: тикеты, чат с командой FastIO, статусы обращений',
  tenantModule: false,

  routes: [
    { path: '/help/support', purpose: 'Форма создания тикета + история обращений' },
  ],

  // permissions: intentionally empty — поддержка доступна всем ролям тенанта
  permissions: [],

  db: {
    tables: [
      'support_messages',
      'support_tickets',
    ],
    rpc: ['get_tenant_unread_support_count'],
  },

  realtime: [
    { table: 'support_messages', channelComposable: 'useSupportChannel', events: ['insert', 'update'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.stores.tenant',
    'shared.stores.auth',
    'shared.utils.supportStatus',
  ],
})
