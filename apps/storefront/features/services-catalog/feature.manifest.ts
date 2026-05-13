import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'services-catalog',
  vertical: 'services',
  purpose: 'Каталог услуг: store + секция витрины + модалка деталей услуги (используется services-tenant\'ами)',

  routes: [
    // Каталог услуг рендерится секцией на главной странице (pages/index.vue) под services-tenant'ом
    // — отдельной страницы нет.
  ],

  db: {
    // Прямого supabase.from() нет — данные приходят через серверный endpoint /api/services
    // (см. apps/storefront/server/api/services.get.ts), вызываемый из приложения SSR-этапа.
    tables: [],
  },

  dependsOn: [
    'features.branch',
    'features.cart',
    'shared.composables.useConfirm',
    'shared.composables.useCurrency',         // форматирование цен на карточках
    'shared.composables.useItemPlaceholder',  // плейсхолдер для услуг без фото
    'shared.composables.useLegalCompliance',
    'shared.composables.useToast',
    'shared.ui.sf.domain.DishChips',
    'shared.ui.sf.domain.SfEmptyState',
    'shared.ui.sf.domain.SfProductCard',
    'shared.ui.sf.domain.SfProductModal',
    'shared.utils.product',                   // buildProduct → ProductData для SfProductCard
    'server.api.services',
    '@fastio/shared',                         // type Service, ServiceCategory, ServiceResource
  ],
})
