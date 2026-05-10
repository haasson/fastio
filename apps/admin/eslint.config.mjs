import eslintConfig from '@fastio/shared/configs/eslint'

// ──────────────────────────────────────────────────────────────────────────────
// Вертикальная изоляция services ↔ retail.
// Полная конвенция: docs/vertical-isolation.md
// ──────────────────────────────────────────────────────────────────────────────

const SERVICES_GLOBS = [
  // Legacy paths (постепенно опустеют по мере миграции; некоторые ещё содержат
  // services-catalog файлы или layout-страницы Nuxt).
  'composables/services/**',
  'utils/api/services/**',
  'components/services/**',
  'pages/services/**',
  'pages/appointments/**',
  // Top-level layout-страницы (Nuxt nested routing) — относятся к вертикали
  'pages/services.vue',
  'pages/appointments.vue',
  // Modular paths
  'features/appointments/**',
  'features/services-catalog/**',
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
  // Modular paths
  'features/kitchen/**',
  'features/reservations/**',
  'features/tables/**',
  'features/promotions/**',
  'features/orders/**',
  'features/menu/**',
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
  'composables/useRealtimeChannels.ts',
  'components/layout/AppNav.vue',
  'shared/utils/moduleToggleChecks.ts',
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
    // Modular alias paths — и barrel (~/features/X), и deep (~/features/X/...).
    // Barrel-форма нужна, чтобы no-restricted-imports срабатывал и на cross-vertical
    // импорт через canonical barrel.
    '~/features/kitchen',
    '~/features/kitchen/**',
    '~/features/reservations',
    '~/features/reservations/**',
    '~/features/tables',
    '~/features/tables/**',
    '~/features/promotions',
    '~/features/promotions/**',
    '~/features/orders',
    '~/features/orders/**',
    '~/features/menu',
    '~/features/menu/**',
  ],
  services: [
    // Legacy alias paths
    '~/composables/services/**',
    '~/utils/api/services/**',
    '~/components/services/**',
    '~/pages/services/**',
    '~/pages/appointments/**',
    // Modular alias paths
    '~/features/appointments',
    '~/features/appointments/**',
    '~/features/services-catalog',
    '~/features/services-catalog/**',
  ],
}

// Относительные паттерны: ловят `'../retail/foo'`, `'../../services/bar'` и т.п.
// Без них барьер легко обходился sibling-импортом из shared `__tests__/` в вертикаль.
const RELATIVE_VERTICAL_PATTERNS = {
  retail: ['**/retail/**'],
  services: ['**/services/**'],
}

// Модульная изоляция: cross-module импорт через ~/features/<X>/<deep> запрещён —
// нужно через ~/features/<X> (barrel). См. TECHDEBT (block module-isolation
// в no-restricted-imports — best-effort из-за ограничений minimatch extglob).
const MODULE_ISOLATION_PATTERN = {
  group: ['~/features/*/!(index)', '~/features/*/!(index)/**'],
  message: 'Cross-module импорт только через ~/features/<feature> (barrel index.ts), не deep path. Внутри своего модуля используй относительные пути.',
}

const banFromServices = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.retail, ...RELATIVE_VERTICAL_PATTERNS.retail],
      message: 'Services не может импортировать retail. Если нужно общее — вынеси в shared (docs/vertical-isolation.md).',
    },
    MODULE_ISOLATION_PATTERN,
  ],
}

const banFromRetail = {
  patterns: [
    {
      group: [...ALIAS_VERTICAL_PATTERNS.services, ...RELATIVE_VERTICAL_PATTERNS.services],
      message: 'Retail не может импортировать services. Если нужно общее — вынеси в shared (docs/vertical-isolation.md).',
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
      message: 'Shared-код НЕ ДОЛЖЕН знать о вертикалях. Зависимость идёт только ОТ вертикали К shared (docs/vertical-isolation.md).',
    },
    MODULE_ISOLATION_PATTERN,
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
      'composables/*.ts',
      'composables/data/**',
      'composables/plan/**',
      'composables/__tests__/**',
      'composables/ui/**',
      'utils/api/*.ts',
      'utils/api/__tests__/**',
      'shared/utils/*.ts',
      'shared/utils/__tests__/**',
      'shared/stores/*.ts',
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

  // ──────────────────────────────────────────────────────────────────────────
  // Модульная изоляция (~/features/*/<deep> через barrel) встроена в
  // banFromServices/banFromRetail/banFromShared выше. Отдельного блока для
  // features/** нет, потому что в flat config rule с files: ['features/**']
  // переопределил бы no-restricted-imports вертикального правила (paths
  // не сливаются, последний матчующий блок перезаписывает rule целиком).
  // ──────────────────────────────────────────────────────────────────────────

  // shared/* НЕ ДОЛЖЕН импортить из features/* + НЕ должен знать о вертикалях.
  // Объединено с banFromShared, потому что rule no-restricted-imports не сливается
  // между блоками — последний матчующий блок переопределяет правило целиком.
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
            message: 'Shared-код НЕ ДОЛЖЕН знать о вертикалях. Зависимость идёт только ОТ вертикали К shared (docs/vertical-isolation.md).',
          },
          {
            group: ['~/features/**', '../features/**'],
            message: 'shared НЕ ДОЛЖЕН импортить из modules. Зависимость идёт только ОТ модуля К shared.',
          },
        ],
      }],
    },
  },

  // Исключения для shared-агрегаторов, которые по дизайну знают о features/*.
  // Аналог composables/data/useDatabase.ts в AGGREGATOR_FILES.
  // - shared/stores/branch.ts оборачивает useBranches/useBranch из features/branches
  // - shared/utils/moduleToggleChecks.ts проверяет блокеры отключения модулей
  //   и должен видеть feature-state (например, активные брони)
  {
    files: ['shared/stores/branch.ts', 'shared/utils/moduleToggleChecks.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // 5. Серверный мир (AI-context и т.п.) — отдельная вселенная
  {
    files: ['server/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
