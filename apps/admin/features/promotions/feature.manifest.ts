import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'promotions',
  vertical: 'retail',
  purpose: 'Акции и промокоды: правила скидок, временные рамки, ограничения по корзине/блюдам',
  tenantModule: true,

  routes: [
    { path: '/promotions/list', purpose: 'Список акций (CRUD)' },
    { path: '/promotions/promo-codes', purpose: 'Промокоды: генерация, лимиты, статистика использования' },
  ],

  permissions: [
    'promos.view',
    'promos.manage',
  ],

  db: {
    tables: ['promotions', 'promo_codes'],
  },

  realtime: [
    { table: 'promotions', channelComposable: 'usePromotions', events: ['insert', 'update', 'delete'] },
    { table: 'promo_codes', channelComposable: 'usePromoCodes', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.stores.tenant',
    'features.menu',
    '@fastio/shared',
  ],
})
