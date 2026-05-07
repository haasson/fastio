import eslintConfig from '@fastio/shared/configs/eslint'

// ──────────────────────────────────────────────────────────────────────────────
// Вертикальная изоляция services ↔ retail.
// Полная конвенция: docs/vertical-isolation.md
// ──────────────────────────────────────────────────────────────────────────────

const SERVICES_GLOBS = [
  'composables/services/**',
  'utils/api/services/**',
  'utils/services/**',
  'stores/services/**',
  'components/services/**',
  'components/appointments/**',
  'pages/services/**',
  'pages/appointments/**',
  // Top-level layout-страницы (Nuxt nested routing) — относятся к вертикали
  'pages/services.vue',
  'pages/appointments.vue',
]

const RETAIL_GLOBS = [
  'composables/retail/**',
  'utils/api/retail/**',
  'utils/retail/**',
  'config/retail/**',
  'stores/retail/**',
  'components/menu/**',
  'components/orders/**',
  'components/kitchen/**',
  'components/tables/**',
  'components/reservations/**',
  'components/promotions/**',
  'components/retail/**',
  'pages/menu/**',
  'pages/orders/**',
  'pages/kitchen/**',
  'pages/tables/**',
  'pages/reservations/**',
  'pages/promotions/**',
  // Top-level layout-страницы (Nuxt nested routing) — относятся к вертикали
  'pages/menu.vue',
  'pages/orders.vue',
  'pages/kitchen.vue',
  'pages/tables.vue',
  'pages/reservations.vue',
  'pages/promotions.vue',
]

// Файлы, которым по дизайну разрешено знать обе вертикали.
// Полное описание — docs/vertical-isolation.md.
//
// Сюда входят и shared-страницы с условными вертикальными секциями
// (`pages/branches/index.vue` показывает плашку про delivery-зоны для retail;
// `pages/content/banners.vue` даёт селект promotions/promoCodes для retail).
// Это by-design: страница shared, её содержимое адаптируется по `businessType`/гейтам.
const AGGREGATOR_FILES = [
  'composables/data/useDatabase.ts',
  'composables/plan/useGate.ts',
  'composables/plan/useGate.routes.ts',
  'components/layout/AppNav.vue',
  'utils/moduleToggleChecks.ts',
  'config/modules.ts',
  'config/team-roles.ts',
  'pages/index.vue',
  'pages/branches/index.vue',
  'pages/content/banners.vue',
]

// Алиасные паттерны для импортов через `~/`.
const ALIAS_VERTICAL_PATTERNS = {
  retail: [
    '~/composables/retail/**',
    '~/utils/api/retail/**',
    '~/utils/retail/**',
    '~/config/retail/**',
    '~/stores/retail/**',
    '~/components/menu/**',
    '~/components/orders/**',
    '~/components/kitchen/**',
    '~/components/tables/**',
    '~/components/reservations/**',
    '~/components/promotions/**',
    '~/components/retail/**',
    '~/pages/menu/**',
    '~/pages/orders/**',
    '~/pages/kitchen/**',
    '~/pages/tables/**',
    '~/pages/reservations/**',
    '~/pages/promotions/**',
  ],
  services: [
    '~/composables/services/**',
    '~/utils/api/services/**',
    '~/utils/services/**',
    '~/stores/services/**',
    '~/components/services/**',
    '~/components/appointments/**',
    '~/pages/services/**',
    '~/pages/appointments/**',
  ],
}

// Относительные паттерны: ловят `'../retail/foo'`, `'../../services/bar'` и т.п.
// Без них барьер легко обходился sibling-импортом из shared `__tests__/` в вертикаль.
const RELATIVE_VERTICAL_PATTERNS = {
  retail: ['**/retail/**'],
  services: ['**/services/**'],
}

const banFromServices = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.retail, ...RELATIVE_VERTICAL_PATTERNS.retail],
      message: 'Services не может импортировать retail. Если нужно общее — вынеси в shared (docs/vertical-isolation.md).',
    },
  ],
}

const banFromRetail = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.services, ...RELATIVE_VERTICAL_PATTERNS.services],
      message: 'Retail не может импортировать services. Если нужно общее — вынеси в shared (docs/vertical-isolation.md).',
    },
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
      message: 'Shared-код НЕ ДОЛЖЕН знать о вертикалях. Зависимость идёт только ОТ вертикали К shared (docs/vertical-isolation.md).',
    },
  ],
}

export default [
  ...eslintConfig,

  // 1. Услуги: запрет ходить в retail
  {
    files: SERVICES_GLOBS,
    rules: { 'no-restricted-imports': ['error', banFromServices] },
  },

  // 2. Retail: запрет ходить в services
  {
    files: RETAIL_GLOBS,
    rules: { 'no-restricted-imports': ['error', banFromRetail] },
  },

  // 3. Shared (всё остальное): запрет ходить в любую вертикаль.
  // Top-level pages/*.vue перечисляем явно — `pages/kitchen.vue`, `pages/orders.vue`
  // и пр. это retail/services layout-файлы (Nuxt nested routing), они в вертикалях.
  {
    files: [
      'composables/data/**',
      'composables/plan/**',
      'composables/__tests__/**',
      'composables/ui/**',
      'stores/*.ts',
      'utils/api/*.ts',
      'utils/api/__tests__/**',
      'utils/*.ts',
      'utils/__tests__/**',
      'config/*.ts',
      'components/*.vue',
      'components/ai/**',
      'components/appearance/**',
      'components/billing/**',
      'components/catalog/**',
      'components/dashboard/**',
      'components/gallery/**',
      'components/legal/**',
      'components/onboarding/**',
      'components/settings/**',
      'components/support/**',
      'components/ui/**',
      // shared layout-страницы (top-level)
      'pages/account.vue',
      'pages/appearance.vue',
      'pages/audit-log.vue',
      'pages/branches.vue',
      'pages/content.vue',
      'pages/help.vue',
      'pages/invite.vue',
      'pages/login.vue',
      'pages/no-access.vue',
      'pages/set-password.vue',
      'pages/settings.vue',
      'pages/suspended.vue',
      'pages/team.vue',
      // shared разделы pages/
      'pages/account/**',
      'pages/appearance/**',
      'pages/branches/**',
      'pages/content/**',
      'pages/help/**',
      'pages/legal/**',
      'pages/settings/**',
      'pages/team/**',
    ],
    rules: { 'no-restricted-imports': ['error', banFromShared] },
  },

  // 4. Allow-list агрегаторов: правила выключены (они by design знают всё)
  {
    files: AGGREGATOR_FILES,
    rules: { 'no-restricted-imports': 'off' },
  },

  // 5. Серверный мир (AI-context и т.п.) — отдельная вселенная
  {
    files: ['server/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
