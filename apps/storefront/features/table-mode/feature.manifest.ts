import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'table-mode',
  vertical: 'retail',
  purpose: 'Режим стола: гость по QR-коду видит свой чек в реальном времени (заказанные блюда, статусы из кухни)',

  routes: [
    { path: '/table/[id]', purpose: 'Главная страница режима стола: список позиций чека + статусы' },
  ],

  db: {
    // Прямой supabase.from() в realtime-канале (подписка на order_items + kitchen_queue).
    // table_calls / table_call_types / tables — через server endpoints, в feature/ напрямую не читаются.
    tables: ['order_items', 'kitchen_queue'],
  },

  realtime: [
    { table: 'order_items', channelComposable: 'useTableRealtime', events: ['insert', 'update', 'delete'] },
    { table: 'kitchen_queue', channelComposable: 'useTableRealtime', events: ['insert', 'update', 'delete'] },
  ],

  dependsOn: [
    'features.cart',
    'features.menu-catalog',
    'shared.composables.useSupabaseClient', // realtime-канал к order_items / kitchen_queue
    'shared.composables.useToast',
    'shared.ui.sf.domain.SfFab',
    '@fastio/shared',                       // getItemUnitPrice, formatPrice
  ],
})
