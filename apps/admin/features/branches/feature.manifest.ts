import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'branches',
  vertical: 'shared',
  purpose: 'Филиалы тенанта: CRUD, переключение текущего, настройки рабочих часов',
  tenantModule: true,

  routes: [
    { path: '/branches', purpose: 'Список филиалов + создание' },
    { path: '/branches/settings', purpose: 'Настройки конкретного филиала (часы, контакты)' },
  ],

  permissions: [
    'settings.view',
    'settings.edit',
  ],

  db: {
    tables: ['appointments', 'branches', 'order_statuses', 'orders', 'reservations', 'tables'],
    // useBranches/useBranch также читают `orders` и `order_statuses` для счётчиков по филиалу.
    // `reservations`/`appointments` читаются в hasActiveReservations/hasActiveAppointments
    // — guard от архивации филиала с активными бронями/записями (PREPROD-020).
  },

  dependsOn: [
    'features.audit-log',
    'features.legal',
    'features.settings',
    'shared.composables.usePageTitle',
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.plan.useBranchLimit',
    'shared.plan.useGate',
    'shared.plan.useGate.helpers',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.TabsLayout',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.filterDefined',
    'shared.utils.query',
    '@fastio/shared',
  ],
  realtime: [
    { table: 'branches', channelComposable: 'useBranches', events: ['insert', 'update', 'delete'] },
  ],
})
