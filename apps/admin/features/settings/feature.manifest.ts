import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'settings',
  vertical: 'shared',
  purpose: 'Общие настройки тенанта: контакты, уведомления, юридические страницы, модули, настройки модулей',
  tenantModule: false,

  routes: [
    { path: '/settings/contacts', purpose: 'Контакты заведения (телефоны, email, адрес)' },
    { path: '/settings/notifications', purpose: 'Каналы уведомлений (email/sms) + пресеты' },
    { path: '/settings/legal', purpose: 'Юридические страницы и реквизиты' },
    { path: '/settings/modules', purpose: 'Включение/отключение модулей (TenantModules) с проверкой блокеров' },
  ],

  permissions: [
    'settings.view',
    'settings.edit',
  ],

  db: {
    tables: ['module_configs'],
    // Большая часть «настроек» — это поля в самом tenants, мутации идут через tenantStore.update
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.utils.moduleToggleChecks',
    'shared.plan.useModules',
    '@fastio/shared',
  ],
})
