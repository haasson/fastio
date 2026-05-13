import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'content',
  vertical: 'shared',
  purpose: 'Контент витрины: баннеры, фотогалереи, вакансии, отзывы',
  tenantModule: false,

  routes: [
    { path: '/content/banners', purpose: 'Баннеры главной (промо-блоки)' },
    { path: '/content/gallery', purpose: 'Фотогалереи (для разделов витрины)' },
    { path: '/content/reviews', purpose: 'Модерация отзывов гостей' },
    { path: '/content/vacancies', purpose: 'Вакансии (если есть HR-секция)' },
  ],

  permissions: [
    'content.view',
    'content.edit',
  ],

  db: {
    tables: ['banners', 'galleries', 'gallery_photos'],
    // reviews/vacancies могут жить в jsonb-полях tenants или иметь свои таблицы — проверь миграции
  },

  dependsOn: [
    'features.promotions',
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.ui.components.AppStorefrontAlert',
    'shared.ui.components.ImageUploadModal',
    'shared.utils.imageOptimize',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
