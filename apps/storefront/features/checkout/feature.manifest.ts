import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'checkout',
  vertical: 'shared',
  purpose: 'Чекаут: оформление заказа из корзины (адрес/филиал/самовывоз/промо/контакты/submit) — работает и с блюдами, и с услугами',

  routes: [
    { path: '/checkout', purpose: 'Главная страница чекаута (общая для блюд и услуг)' },
  ],

  db: {
    // Чекаут не ходит в БД напрямую — все мутации через /api/orders (retail)
    // и /api/appointments/request (services) на сервере.
    tables: [],
  },

  dependsOn: [
    'features.auth',                          // профиль гостя (имя/телефон/email из аккаунта)
    'features.cart',                          // корзина — источник данных
    'features.menu-catalog',                  // dish lookup для validation
    'shared.composables.useConfirm',
    'shared.composables.useDadataSuggestions',
    'shared.composables.useLegalCompliance',
    'shared.composables.useStorefrontTerms',
    'shared.composables.useSupabaseClient',
    'shared.ui.layout.StorePageLayout',
    'shared.ui.sections.PageShell',
    'shared.ui.sf.domain.SfOrderItemsList',
    'shared.ui.sf.domain.SfOrderTotals',
    'server.api.orders',
    'server.api.appointments.request',
    '@fastio/shared',                         // calcOrderTotals, DeliveryZone, Address
  ],
})
