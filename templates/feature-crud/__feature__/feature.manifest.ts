import { defineFeature } from '../_manifest'

export default defineFeature({
  key: '__FEATURE_KEY__',
  vertical: '__VERTICAL__', // 'retail' | 'services' | 'shared'
  purpose: '__PURPOSE__',
  // true если фича toggleable через TenantModules (ключ должен быть в packages/shared/src/types/tenant.ts)
  tenantModule: false,

  routes: [
    // { path: '/__FEATURE_KEY__/list', purpose: 'Список' },
    // { path: '/__FEATURE_KEY__/[id]', purpose: 'Карточка' },
  ],

  permissions: [
    // 'feature.view',
    // 'feature.manage',
  ],

  db: {
    tables: ['__TABLE__'],
    // rpc: ['create_thing', 'update_thing'],
  },

  realtime: [
    {
      table: '__TABLE__',
      channelComposable: 'use__FEATURE_PASCAL__sChannel',
      events: ['insert', 'update', 'delete'],
    },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.stores.tenant',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
