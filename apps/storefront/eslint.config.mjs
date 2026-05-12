// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// ──────────────────────────────────────────────────────────────────────────────
// Вертикальная изоляция services ↔ retail (storefront).
// Полная конвенция: docs/vertical-isolation.md (admin) + docs/plans/2026-05-12-storefront-modular-migration.md.
// На витрине нет permissions/RBAC и tenant-модулей, поэтому правила проще:
//   - retail components/features не импортят services и наоборот
//   - cross-vertical pages и аггрегаторы (app.vue, layout) — в allow-list
// ──────────────────────────────────────────────────────────────────────────────

// На витрине cart/checkout — ГИБРИДНЫЕ shared-aggregator'ы: хранят и DishCartItem,
// и ServiceCartItem, обрабатывают оба flow в одной корзине/чекауте.
// Поэтому они НЕ в RETAIL_GLOBS, а в AGGREGATOR_FILES (могут видеть обе вертикали).

const SERVICES_GLOBS = [
  // Vertical pages
  'pages/appointments/**',
  'pages/account/appointments.vue',
  // Modular paths
  'features/services-catalog/**',
  'features/appointments/**',
]

const RETAIL_GLOBS = [
  // Vertical pages (только те, где НЕТ services-fallback)
  'pages/order/**',
  'pages/table/**',
  'pages/promotions/**',
  'pages/account/orders.vue',
  // Booking = бронь стола в ресторане (retail). Endpoint /api/reservations.
  'pages/booking.vue',
  // Delivery — настройка адреса доставки еды (retail-only).
  'pages/delivery.vue',
  // Vertical components
  'components/table/**',
  'components/booking/**',
  'components/delivery/**',
  // Modular paths (после миграции)
  'features/booking/**',
  'features/menu-catalog/**',
  'features/order-tracking/**',
  'features/promotions/**',
  'features/table-mode/**',
]

// Файлы которые по дизайну видят обе вертикали:
//   - app.vue, pages/index.vue, layout — global
//   - pages/account/index.vue — кабинет показывает и orders (retail), и appointments (services)
//   - cart/checkout — единая корзина для блюд + услуг (гибридный flow)
//   - stores/cart, stores/checkout — данные обоих flow
const AGGREGATOR_FILES = [
  'app.vue',
  'pages/index.vue',
  'pages/account/index.vue',
  'pages/cart.vue',
  'pages/checkout.vue',
  // pages/menu.vue и /category/[slug].vue — гибридные: показывают MenuSection ИЛИ ServicesSection
  // в зависимости от типа тенанта (см. computed useServicesCatalog).
  'pages/menu.vue',
  'pages/category/**',
  // Cart/checkout features (shared aggregator модули)
  'features/cart/**',
  'features/checkout/**',
  // shared UI которые по дизайну знают о features (header с cart-fab/auth-menu,
  // catalog-mode определяющий тип витрины, product-card с add-to-cart).
  'shared/composables/useCatalogMode.ts',
  'shared/ui/HeaderUserMenu.vue',
  'shared/ui/MobileUserCard.vue',
  'shared/ui/sections/PageShell.vue',
  'shared/ui/sections/SiteHeader.vue',
  'shared/ui/sf/domain/SfCartFab.vue',
  'shared/ui/sf/domain/SfProductCard.vue',
]

const ALIAS_VERTICAL_PATTERNS = {
  retail: [
    '~/components/table/**',
    '~/components/booking/**',
    '~/components/delivery/**',
    '~/pages/order/**',
    '~/pages/table/**',
    '~/pages/promotions/**',
    '~/features/booking',
    '~/features/booking/**',
    '~/features/menu-catalog',
    '~/features/menu-catalog/**',
    '~/features/order-tracking',
    '~/features/order-tracking/**',
    '~/features/promotions',
    '~/features/promotions/**',
    '~/features/table-mode',
    '~/features/table-mode/**',
  ],
  services: [
    '~/pages/appointments/**',
    '~/features/services-catalog',
    '~/features/services-catalog/**',
    '~/features/appointments',
    '~/features/appointments/**',
  ],
}

const RELATIVE_VERTICAL_PATTERNS = {
  retail: ['**/booking/**', '**/menu-catalog/**', '**/order-tracking/**', '**/promotions/**', '**/table-mode/**'],
  services: ['**/appointments/**', '**/services-catalog/**'],
}

// Модульная изоляция: cross-module импорт TS-модулей через ~/features/<X>/<deep>
// запрещён — нужно через ~/features/<X> (barrel). Внутри своего модуля
// используй относительные пути.
//
// Vue-компоненты разрешены deep-path (~/features/<X>/components/<Y>.vue) —
// чтобы не раздувать barrel и явно показывать кросс-модульное использование.
const MODULE_ISOLATION_PATTERN = {
  group: [
    '~/features/*/api/**',
    '~/features/*/composables/**',
    '~/features/*/utils/**',
    '~/features/*/stores/**',
    '~/features/*/types',
    '~/features/*/types/**',
  ],
  message: 'Cross-module импорт TS-модулей только через ~/features/<feature> (barrel index.ts), не deep path. Внутри своего модуля — относительные пути. Vue-компоненты — deep-path разрешён (~/features/<X>/components/<Y>.vue). Если это утилка/composable, нужная другому модулю — лучше вынеси в shared/utils или @fastio/shared, чем реэкспортировать через barrel.',
}

const banFromServices = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.retail, ...RELATIVE_VERTICAL_PATTERNS.retail],
      message: 'Services не может импортировать retail (storefront). Если нужно общее — вынеси в shared.',
    },
    MODULE_ISOLATION_PATTERN,
  ],
}

const banFromRetail = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.services, ...RELATIVE_VERTICAL_PATTERNS.services],
      message: 'Retail не может импортировать services (storefront). Если нужно общее — вынеси в shared.',
    },
    MODULE_ISOLATION_PATTERN,
  ],
}

const banFromShared = {
  patterns: [
    {
      group: [
        ...ALIAS_VERTICAL_PATTERNS.retail,
        ...ALIAS_VERTICAL_PATTERNS.services,
        ...RELATIVE_VERTICAL_PATTERNS.retail,
        ...RELATIVE_VERTICAL_PATTERNS.services,
      ],
      message: 'Shared-код НЕ ДОЛЖЕН знать о вертикалях. Зависимость идёт только ОТ вертикали К shared.',
    },
    MODULE_ISOLATION_PATTERN,
  ],
}

export default withNuxt(
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off',
    },
  },

  // 1. Services-вертикаль: запрет ходить в retail
  {
    files: SERVICES_GLOBS,
    rules: { 'no-restricted-imports': ['error', banFromServices] },
  },

  // 2. Retail-вертикаль: запрет ходить в services
  {
    files: RETAIL_GLOBS,
    rules: { 'no-restricted-imports': ['error', banFromRetail] },
  },

  // 3. Shared pages, которые НЕ aggregator'ы — запрет на обе вертикали.
  // (shared/** покрывается отдельным правилом ниже с дополнительной защитой от features/*)
  {
    files: [
      'pages/about.vue',
      'pages/gallery.vue',
      'pages/vacancies.vue',
      'pages/privacy.vue',
      'pages/reset-password.vue',
      'pages/ui.vue',
      'pages/account/profile.vue',
      'pages/account/addresses.vue',
    ],
    rules: { 'no-restricted-imports': ['error', banFromShared] },
  },

  // 4. shared/** — НЕ должен знать о вертикалях И НЕ должен импортить из features/*.
  // (Объединение banFromShared + ban features/* в одном блоке.)
  {
    files: ['shared/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              ...ALIAS_VERTICAL_PATTERNS.retail,
              ...ALIAS_VERTICAL_PATTERNS.services,
              ...RELATIVE_VERTICAL_PATTERNS.retail,
              ...RELATIVE_VERTICAL_PATTERNS.services,
            ],
            message: 'Shared-код НЕ ДОЛЖЕН знать о вертикалях. Зависимость идёт только ОТ вертикали К shared.',
          },
          {
            group: ['~/features/**', '../features/**'],
            message: 'shared НЕ ДОЛЖЕН импортить из features. Зависимость идёт только ОТ модуля К shared.',
          },
        ],
      }],
    },
  },

  // 5. Серверный мир — отдельная вселенная
  {
    files: ['server/**'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ⚠ MUST BE LAST — порядок имеет значение для ESLint flat config.
  // Этот allow-list агрегаторов перебивает shared/** ban из правила 4 для конкретных
  // файлов (useCatalogMode, SiteHeader, SfCartFab и т.д.), которые по дизайну видят
  // обе вертикали и импортят features. ЛЮБОЕ новое правило с `no-restricted-imports`
  // должно добавляться ВЫШЕ этого блока, иначе оно не сработает для агрегаторов.
  // ════════════════════════════════════════════════════════════════════════════
  // 6. Allow-list агрегаторов
  {
    files: AGGREGATOR_FILES,
    rules: { 'no-restricted-imports': 'off' },
  },
)
