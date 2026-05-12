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
    'features.cart',                 // корзина — источник данных
    'features.menu-catalog',         // dish lookup для validation
    'features.auth',                 // профиль гостя (имя/телефон/email из аккаунта)
    'features.account',              // сохранённые адреса доставки
    'features.branch',               // выбранный филиал → branchId в заказе
    'shared.composables.useToast',
    '@fastio/shared',                // calcOrderTotals, DeliveryZone, Address
    'server.api.orders',
    'server.api.appointments.request',
  ],
})
