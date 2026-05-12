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

  realtime: [
    { table: 'banners', channelComposable: 'useBanners', events: ['insert', 'update', 'delete'] },
    { table: 'galleries', channelComposable: 'useGalleries', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.stores.tenant',
    'shared.utils.imageOptimize',
    '@fastio/shared',
  ],
})
