import { defineFeature } from '../_manifest'

export default defineFeature({
  key: '__FEATURE_KEY__',
  vertical: '__VERTICAL__', // 'retail' | 'services' | 'shared'
  purpose: '__PURPOSE__',

  routes: [
    // { path: '/__FEATURE_KEY__', purpose: 'Основная страница фичи' },
  ],

  db: {
    // На витрине большинство фич ходит через Nitro endpoints (server/api/*),
    // прямой supabase.from() редок. Если у тебя нет client-side api/ —
    // оставь tables пустым и опиши зависимости через dependsOn: 'server.api.<endpoint>'.
    tables: [],
    // rpc: [],
  },

  // realtime: [
  //   {
  //     table: '__TABLE__',
  //     channelComposable: 'use__FEATURE_PASCAL__sChannel',
  //     events: ['insert', 'update', 'delete'],
  //   },
  // ],

  dependsOn: [
    'shared.composables.useToast',
    '@fastio/shared',
    // 'server.api.__FEATURE_KEY__', // если фича вызывает Nitro-эндпоинт
  ],
})
