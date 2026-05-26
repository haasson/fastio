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
    tables: ['module_configs', 'telegram_link_codes', 'tenant_telegram_subscribers', 'tenants'],
    // Большая часть «настроек» — это поля в самом tenants, мутации идут через tenantStore.update
  },

  dependsOn: [
    'features.branches',
    'shared.composables.delivery.usePolygonDraw',
    'shared.data.useDatabase',
    'shared.plan.useGate',
    'shared.plan.useGate.helpers',
    'shared.plan.useModules',
    'shared.plan.usePlans',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.AddressWithMap',
    'shared.ui.components.ColorSwatch',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.moduleToggleChecks',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
