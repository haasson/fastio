import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'reservations',
  vertical: 'retail',
  purpose: 'Бронирования столов: создание, подтверждение, рассадка, архив, настройки',
  tenantModule: true,

  routes: [
    { path: '/reservations/list', purpose: 'Активные брони с фильтрами и пагинацией' },
    { path: '/reservations/archive', purpose: 'Архив завершённых/отменённых' },
    { path: '/reservations/settings', purpose: 'Слоты, буфер, авто-подтверждение, лимиты гостей' },
  ],

  permissions: [
    'reservations.view',
    'reservations.manage',
  ],

  db: {
    tables: ['reservations', 'reservation_settings'],
  },

  realtime: [
    {
      table: 'reservations',
      channelComposable: 'useReservationsChannel',
      events: ['insert', 'update', 'delete'],
    },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.stores.tenant',
    'shared.stores.branch',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
