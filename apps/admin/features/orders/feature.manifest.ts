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
    tables: [
      'delivery_zones',
      'order_events',
      'order_items',
      'order_notes',
      'order_statuses',
      'orders',
    ],
    rpc: ['ensure_scheduled_holding_status'],
  },

  realtime: [
    { table: 'orders', channelComposable: 'useOrdersChannel', events: ['insert', 'update', 'delete'] },
    { table: 'order_events', channelComposable: 'useOrderEvents', events: ['insert'] },
    { table: 'order_statuses', channelComposable: 'useOrderStatuses', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.data.useRealtimeWatch',
    'shared.stores.tenant',
    'shared.stores.branch',
    'shared.utils.query',
    '@fastio/shared',
  ],
})
