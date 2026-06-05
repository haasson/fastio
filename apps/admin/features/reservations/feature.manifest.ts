import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'reservations',
  vertical: 'retail',
  purpose: 'Бронирования столов: создание, подтверждение, рассадка, архив. Часть модуля «Столы» (dineIn) — собственных страниц нет, UI живёт под /tables/reservations и /tables/settings',
  // Не отдельный тенант-модуль: брони включаются модулем «Столы» (dineIn).
  // Приём онлайн-броней — под-флаг table_settings.booking_enabled.
  tenantModule: false,

  // Страниц больше нет — фича-библиотека (api/composables/store/components),
  // её потребляют страницы под pages/tables/.
  routes: [],

  // Своих прав нет: брони под правами модуля «Столы». Просмотр/управление —
  // tables.view/tables.manage; настройки броней — settings.edit.
  permissions: [
    'tables.view',
    'tables.manage',
    'settings.edit',
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
    'shared.components.AppTableToolbar',
    'shared.data.useDatabase',
    'shared.data.useRealtimeWatch',
    'shared.plan.useGate',
    'shared.stores.auth',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.AppStorefrontAlert',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
