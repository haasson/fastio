import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'account',
  vertical: 'shared',
  purpose: 'Личный кабинет гостя: профиль, сохранённые адреса доставки, история заказов (retail) и записей (services)',

  routes: [
    { path: '/account', purpose: 'Главная страница кабинета (dashboard со сводкой)' },
    { path: '/account/profile', purpose: 'Профиль: имя, телефон, email, удаление аккаунта' },
    { path: '/account/addresses', purpose: 'Управление сохранёнными адресами доставки' },
    { path: '/account/orders', purpose: 'История заказов (retail)' },
    // /account/appointments — отдельный модуль `appointments`, manifest.routes там.
  ],

  db: {
    // Прямого supabase.from() нет — всё через Nitro endpoints /api/customer/*.
    tables: [],
  },

  dependsOn: [
    'features.auth',                // currentCustomer
    'shared.composables.useToast',
    '@fastio/shared',               // type CustomerAddress, Customer
    'server.api.customer.profile',
    'server.api.customer.addresses',
    'server.api.customer.orders',
  ],
})
