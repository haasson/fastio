import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'auth',
  vertical: 'shared',
  purpose: 'Аутентификация гостя storefront: ТОЛЬКО через Telegram (через бота, deep-link / poll). Email/password удалён в PREPROD-099.',

  routes: [
    // Модалка login открывается inline в layout — отдельной страницы нет.
  ],

  db: {
    // Прямого supabase.from() из клиента нет — всё через Supabase auth SDK
    // (onAuthStateChange/setSession/signOut) и Nitro endpoints /api/auth/*
    // (TG init/poll/login/logout + me).
    tables: [],
  },

  dependsOn: [
    'shared.composables.useModal',
    'shared.composables.useSupabaseClient',
    'shared.composables.useLegalCompliance',
    'shared.ui.sf.icons.SfIconTelegram',
    'server.api.auth.telegram',
    'server.api.auth.me',
    'server.api.auth.logout',
    '@fastio/shared',
  ],
})
