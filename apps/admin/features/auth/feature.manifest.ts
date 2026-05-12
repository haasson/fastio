import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'auth',
  vertical: 'shared',
  purpose: 'Авторизация: вход, инвайты, регистрация по приглашению, восстановление пароля',
  tenantModule: false,

  routes: [
    { path: '/login', purpose: 'Вход по email/паролю + magic-link «забыли пароль»', layout: 'false' },
    { path: '/invite', purpose: 'Приём invite-токена и роутинг на /login или /set-password', layout: 'false' },
    { path: '/set-password', purpose: 'Установка пароля (новая регистрация по инвайту) или сброс по reset-токену', layout: 'false' },
    { path: '/no-access', purpose: 'Залогинен, но нет ни одного тенанта/доступа', layout: 'false' },
    { path: '/suspended', purpose: 'Тенант приостановлен — единственный разрешённый путь кроме /account/*', layout: 'false' },
  ],

  // permissions: intentionally empty — авторизация не управляется RBAC, это сама дверь в систему
  permissions: [],

  db: {
    // Все вызовы идут через supabase.auth — таблицы auth.users/auth.sessions
    // напрямую не трогаем. CRUD-API модуля — обёртка над sb.auth.* (без своих таблиц).
    tables: [],
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.auth',
  ],
})
