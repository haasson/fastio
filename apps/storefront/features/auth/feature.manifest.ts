import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'auth',
  vertical: 'shared',
  purpose: 'Аутентификация гостя storefront: email/password + Telegram OAuth (через ботa), восстановление пароля по email',

  routes: [
    { path: '/reset-password', purpose: 'Установка нового пароля по токену из email-ссылки' },
    // Login/Register/ForgotPassword — модалки, не отдельные страницы (открываются inline в layout).
  ],

  db: {
    // Прямого supabase.from() из клиента нет — всё через Supabase auth SDK
    // (signInWithPassword, signUp, resetPasswordForEmail) и Nitro endpoints
    // /api/auth/* для дополнительной валидации.
    tables: [],
  },

  dependsOn: [
    'shared.composables.useModal',
    'shared.composables.useSupabaseClient',         // SDK-обёртка для signInWithPassword/signUp/setSession
    'shared.ui.layout.StorePageLayout',
    'shared.ui.sections.PageShell',
    'shared.ui.sf.icons.SfIconTelegram',
    'server.api.auth',
    'server.api.auth.callback',
    'server.api.auth.telegram',
    'server.api.auth.forgot-password',
    'server.api.auth.reset-password',
    '@fastio/shared',
  ],
})
