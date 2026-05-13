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
    'features.branch',                              // выбранный филиал → branchId в брони
    'shared.composables.useLegalCompliance',
    'shared.composables.useSupabaseClient',         // получение текущего customer-id для брони
    'shared.ui.layout.StorePageLayout',
    'shared.ui.sections.PageShell',
    'shared.ui.sf.domain.SfEmptyState',
    'shared.ui.sf.domain.SfStepper',
    'server.api.reservations',
    'server.api.reservations.slots',
    '@fastio/shared',                               // тип ReservationStatus
  ],
})
