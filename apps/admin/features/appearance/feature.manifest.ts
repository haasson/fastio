import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'appearance',
  vertical: 'shared',
  purpose: 'Внешний вид витрины: тема, секции главной, страницы (about/contacts), SEO, шрифты',
  tenantModule: false,

  routes: [
    { path: '/appearance/theme', purpose: 'Цветовая тема, шрифты, акценты' },
    { path: '/appearance/sections', purpose: 'Секции главной страницы (порядок, видимость)' },
    { path: '/appearance/pages', purpose: 'Кастомные страницы витрины (about/contacts/...)' },
    { path: '/appearance/seo', purpose: 'Meta-теги, OG-image, favicon' },
  ],

  permissions: [
    'content.view',
    'content.edit',
  ],

  db: {
    tables: [],
    // Все «настройки внешнего вида» хранятся в tenants.* (theme, sections, seo — jsonb поля)
    // Мутации идут через tenantStore.update()
  },

  dependsOn: [
    'shared.stores.tenant',
    'shared.data.useDatabase',
    '@fastio/shared',
  ],
})
