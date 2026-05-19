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
    'shared.composables.useIsMobile',   // мобильная компоновка карты vs текста
    'shared.ui.layout.StorePageLayout',
    'shared.ui.sections.PageShell',
    'shared.ui.sf.domain.SfEmptyState',
    'server.api.delivery-zones',
    '@fastio/shared',                   // findDeliveryZone, defaultSiteLayout, formatPrice, type DeliveryZone
  ],
})
