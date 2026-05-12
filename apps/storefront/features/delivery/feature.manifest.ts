import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'delivery',
  vertical: 'retail',
  purpose: 'Витрина доставки еды: карта зон + текстовые описания условий (стоимость, минимум заказа, время)',

  routes: [
    { path: '/delivery', purpose: 'Страница «Доставка»: карта зон + описание условий' },
  ],

  db: {
    // Прямого supabase.from() нет — данные приходят через серверный endpoint
    // /api/delivery-zones (см. apps/storefront/server/api/delivery-zones.get.ts)
    // и /api/tenant (через useNuxtData<Tenant>).
    tables: [],
  },

  dependsOn: [
    'shared.composables.useCurrency',     // форматирование цен в тексте зон
    'shared.composables.useIsMobile',     // мобильная компоновка карты vs текста
    '@fastio/shared',                     // findDeliveryZone, defaultSiteLayout, type DeliveryZone
    'server.api.delivery-zones',
  ],
})
