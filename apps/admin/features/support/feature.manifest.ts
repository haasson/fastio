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
    { table: 'support_tickets', channelComposable: 'useSupportChannel', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.stores.tenant',
    'shared.utils.formatRelativeDate',
    'shared.utils.imageOptimize',
    'shared.utils.query',
    'shared.utils.supportStatus',
    '@fastio/shared',
  ],
})
