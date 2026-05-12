import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'help',
  vertical: 'shared',
  purpose: 'Помощь и онбординг туры: пошаговые подсказки по UI, ссылки на KB, опросы',
  tenantModule: false,

  routes: [
    { path: '/help', purpose: 'Корневая страница помощи' },
    { path: '/help/tours', purpose: 'Список доступных туров (просмотр/перезапуск)' },
    { path: '/help/support', purpose: 'Форма обращения в поддержку' },
  ],

  // permissions: intentionally empty — справка и туры доступны всем ролям
  permissions: [],

  db: {
    tables: [],
    // Прогресс туров хранится в tenants.tours_state (jsonb)
  },

  dependsOn: [
    'shared.stores.tenant',
    'shared.data.useDatabase',
    '@fastio/kb',
  ],
})
