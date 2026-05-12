import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'booking',
  vertical: 'retail',
  purpose: 'Бронь стола в ресторане: выбор даты/времени/гостей/филиала + создание брони через /api/reservations',

  routes: [
    { path: '/booking', purpose: 'Форма брони стола (3 шага: параметры → слот → контакты)' },
  ],

  db: {
    // Прямого supabase.from() нет — всё идёт через Nitro endpoints
    // /api/reservations/slots и /api/reservations (см. apps/storefront/server/api/reservations/*).
    tables: [],
  },

  dependsOn: [
    'shared.composables.useSupabaseClient', // получение текущего customer-id для брони
    'features.branch',                       // выбранный филиал → branchId в брони
    '@fastio/shared',                        // тип ReservationStatus
    'server.api.reservations',
    'server.api.reservations.slots',
  ],
})
