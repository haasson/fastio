import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'menu-catalog',
  vertical: 'retail',
  purpose: 'Каталог блюд: меню, категории, модалка блюда с модификаторами/аддонами/удалением ингредиентов',

  routes: [
    // /menu и /category/[slug] — hybrid-aggregator страницы (рендерят MenuSection ИЛИ
    // ServicesSection в зависимости от tenant.businessType). Менu-catalog только
    // поставляет MenuSection и DishModal для этих страниц — не «владеет» ими.
  ],

  db: {
    // Прямой supabase.from() нет — меню грузится через серверный endpoint /api/menu
    // (см. apps/storefront/server/api/menu.get.ts).
    tables: [],
  },

  dependsOn: [
    'features.branch',
    'features.cart',
    'shared.composables.useItemPlaceholder',  // плейсхолдер для блюд без фото
    'shared.composables.useLegalCompliance',
    'shared.composables.useStorefrontTerms',  // термины «блюдо»/«категория» из vocabulary
    'shared.ui.sf.domain.DishChips',
    'shared.ui.sf.domain.SfEmptyState',
    'shared.ui.sf.domain.SfProductCard',
    'shared.ui.sf.domain.SfStepper',
    'shared.utils.product',                   // buildProduct → ProductData для SfProductCard
    'server.api.menu',
    '@fastio/shared',                         // type Dish, Combo, Category, ClientAddon
  ],
})
