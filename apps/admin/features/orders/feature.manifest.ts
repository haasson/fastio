import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'orders',
  vertical: 'retail',
  purpose: 'Заказы: приём, статусы, события, заметки, доставка, формат номера. Включает delivery/pickup как sub-модули',
  tenantModule: false,

  routes: [
    { path: '/orders', purpose: 'Список заказов (активные/архив) + фильтры' },
    { path: '/orders/[id]', purpose: 'Карточка заказа: позиции, события, статусы, доставка' },
    { path: '/orders/delivery', purpose: 'Настройка доставочных зон' },
    { path: '/orders/order-number', purpose: 'Формат номера заказа (counter/prefix/date)' },
    { path: '/orders/settings', purpose: 'Общие настройки заказов (уведомления, авто-статусы)' },
    { path: '/orders/statuses', purpose: 'Кастомные статусы заказа' },
  ],

  permissions: [
    'orders.view',
    'orders.create',
    'orders.edit',
    'orders.status',
    'orders.cancel',
  ],

  db: {
    tables: ['delivery_zones', 'order_events', 'order_items', 'order_notes', 'order_statuses', 'orders'],
    rpc: ['add_items_to_order', 'delete_order_item_atomic', 'ensure_scheduled_holding_status', 'remove_order_item', 'update_order_item', 'update_order_status', 'update_order_with_items'],
  },

  realtime: [
    { table: 'delivery_zones', channelComposable: 'useAllDeliveryZones', events: ['insert', 'update', 'delete'] },
    { table: 'order_events', channelComposable: 'useOrderEvents', events: ['insert', 'update', 'delete'] },
    { table: 'order_statuses', channelComposable: 'useOrderStatuses', events: ['insert', 'update', 'delete'] },
    { table: 'orders', channelComposable: 'useOrdersChannel', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'features.kitchen',
    'features.legal',
    'features.menu',
    'features.settings',
    'shared.components.AppTableToolbar',
    'shared.composables.delivery.useDadataSuggestions',
    'shared.composables.delivery.useZoneEditor',
    'shared.composables.usePageTitle',
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.data.useRealtimeWatch',
    'shared.plan.useGate',
    'shared.stores.auth',
    'shared.stores.branch',
    'shared.stores.tenant',
    'shared.ui.components.AppStorefrontAlert',
    'shared.ui.components.DishItemRow',
    'shared.ui.components.TabsLayout',
    'shared.ui.composables.useDrawer',
    'shared.ui.composables.useEditableForm',
    'shared.ui.composables.useItemManager',
    'shared.ui.composables.usePageForm',
    'shared.ui.composables.useUnsavedGuard',
    'shared.utils.alerts',
    'shared.utils.filterDefined',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
