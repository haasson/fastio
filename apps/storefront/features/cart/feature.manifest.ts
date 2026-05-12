import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'cart',
  vertical: 'shared',
  purpose: 'Гибридная корзина: хранит DishCartItem (retail/блюда) и ServiceCartItem (services/услуги), сводит в один UI и единый flow на чекаут',

  routes: [
    { path: '/cart', purpose: 'Главная страница корзины (для общепита и сервисного бизнеса)' },
  ],

  db: {
    // Cart живёт целиком на клиенте + localStorage (см. plugins/cart-restore.client.ts).
    // Никаких прямых обращений к таблицам — все позиции синхронизируются с meню/услугами
    // через useCartReconciler.
    tables: [],
  },

  dependsOn: [
    'features.menu-catalog',                 // dish lookup для reconciler
    'features.services-catalog',             // service lookup для reconciler
    'shared.composables.useToast',
    'shared.composables.useStorefrontTerms',
    '@fastio/shared',                        // OrderItem, getItemUnitPrice
  ],
})
