// Конфигурация codemap. Принцип: карта нужна там, где агент НЕ знает что есть готовое решение и
// склонен переизобрести (утилки, общие composables, UI-компоненты, stores). Всё остальное —
// типы, data hooks, API CRUD wrappers, страницы, server endpoints, фичевые модальные компоненты —
// агент сам находит по структуре каталогов и именам файлов.
//
// Каждый проект задаёт:
//   sources[]  — папки с правилами включения/исключения для основного скана
//   assign(rel) — функция для маппинга файла на под-карту (для проектов с одной картой возвращай 'main')
//   maps        — список под-карт (порядок в индексе)
//   purpose     — описание проекта в index.json

import path from 'node:path';

function basenameNoExt(rel) {
  const ext = path.extname(rel);
  return path.basename(rel, ext);
}

// ============================================================
// apps/admin
// Картируем ТОЛЬКО общую инфру: stores, корневые/ui/plan/delivery composables,
// utils корня (НЕ utils/api), config, columns, components/{ui,layout},
// middleware, plugins, layouts. Всё остальное (composables/data,
// composables/{retail,services} — data/CRUD-слой вертикалей, utils/api,
// server endpoints, pages, фичевые components) — НЕ картируем.
// ============================================================

const ADMIN_INCLUDED_DIRS = [
  'stores',
  'config',
  'columns',
  'middleware',
  'plugins',
  'layouts',
];

function adminAssign(rel) {
  // Модульная архитектура — фичевые модули не картируем
  // (агент находит их по ~/features/<feature>/index.ts barrel + по структуре).
  if (rel.startsWith('features/')) return null;
  // shared/* — картируем как общую инфру (utils, plan, stores, ui, layout, components)
  // shared/data/* НЕ картируем: паттерн `useX → CRUD` самообъясняющий (как и
  // оригинальный composables/data/*).
  if (rel.startsWith('shared/')) {
    if (rel.includes('/__tests__/')) return null;
    if (rel.startsWith('shared/data/')) return null;
    return 'main';
  }
  // composables: общие (root, ui, plan, delivery, kitchen, menu, и т.д.)
  // composables/data, composables/retail, composables/services — это data/CRUD
  // вертикалей, имена самообъясняющие (useX → CRUD), не картируем.
  if (rel.startsWith('composables/')) {
    if (rel.startsWith('composables/data/')) return null;
    if (rel.startsWith('composables/retail/')) return null;
    if (rel.startsWith('composables/services/')) return null;
    if (rel.includes('/__tests__/')) return null;
    return 'main';
  }
  // utils: корень — да, /api — нет, /__tests__ — нет.
  // utils/{retail,services} мапятся (это утилиты домена, не CRUD).
  if (rel.startsWith('utils/')) {
    if (rel.startsWith('utils/api/')) return null;
    if (rel.startsWith('utils/__tests__/')) return null;
    return 'main';
  }
  // components: только ui и layout
  if (rel.startsWith('components/')) {
    if (rel.startsWith('components/ui/')) return 'main';
    if (rel.startsWith('components/layout/')) return 'main';
    return null;
  }
  // tours, server, pages, всё остальное — skip
  if (rel.startsWith('tours/')) return null;
  if (rel.startsWith('server/')) return null;
  if (rel.startsWith('pages/')) return null;

  // Включённые папки целиком
  for (const d of ADMIN_INCLUDED_DIRS) {
    if (rel.startsWith(d + '/') || rel === d) return 'main';
  }
  return null;
}

// ============================================================
// apps/storefront
// Аналогично: общая инфра витрины — composables, utils, stores, types,
// components/{sf,layout}, middleware/plugins/layouts. Без server/pages,
// без фичевых components.
// ============================================================

function storefrontAssign(rel) {
  if (rel.startsWith('composables/')) {
    if (rel.includes('/__tests__/')) return null;
    return 'main';
  }
  if (rel.startsWith('utils/')) {
    if (rel.startsWith('utils/__tests__/')) return null;
    return 'main';
  }
  if (rel.startsWith('components/')) {
    if (rel.startsWith('components/sf/')) return 'main';
    if (rel.startsWith('components/layout/')) return 'main';
    return null;
  }
  if (rel.startsWith('server/')) return null;
  if (rel.startsWith('pages/')) return null;

  for (const d of ['stores', 'middleware', 'plugins', 'layouts', 'types', 'app']) {
    if (rel.startsWith(d + '/') || rel === d) return 'main';
  }
  return null;
}

// ============================================================
// project registry
// ============================================================

export const PROJECTS = {
  'apps/admin': {
    purpose: 'Админ-панель Nuxt 3 SPA: меню, заказы, кухня, бронирования, онлайн-запись, акции, настройки тенанта',
    sources: [
      { dir: 'composables', exclude: ['__tests__'] },
      { dir: 'utils', exclude: ['__tests__'] },
      { dir: 'stores' },
      { dir: 'config' },
      { dir: 'columns' },
      { dir: 'middleware' },
      { dir: 'plugins' },
      { dir: 'layouts' },
      { dir: 'components' },
      { dir: 'shared', exclude: ['__tests__'] },
    ],
    assign: adminAssign,
    maps: ['main'],
  },

  'apps/storefront': {
    purpose: 'Витрина для гостя Nuxt 3 SSR: меню, корзина, чекаут, аккаунт, бронирования, онлайн-запись',
    sources: [
      { dir: 'composables', exclude: ['__tests__'] },
      { dir: 'utils', exclude: ['__tests__'] },
      { dir: 'stores' },
      { dir: 'middleware' },
      { dir: 'plugins' },
      { dir: 'layouts' },
      { dir: 'types' },
      { dir: 'app' },
      { dir: 'components' },
    ],
    assign: storefrontAssign,
    maps: ['main'],
  },

  'packages/shared': {
    purpose: 'Общие утилиты и composables проекта (pluralize, planLevel, scheduling, vocabulary, geo, useDadataSuggestions и т.д.). Доменные типы НЕ картируются — читаются напрямую через импорты.',
    sources: [
      { dir: 'src/utils', exclude: ['__tests__'] },
      { dir: 'src/composables' },
    ],
    assign: () => 'main',
    maps: ['main'],
  },

  'packages/ui': {
    purpose: 'UI-компоненты на базе Naive UI (UiCard, UiText, UiButton, UiTitle, UiTag и т.д.) для admin',
    sources: [{ dir: 'src' }],
    assign: () => 'main',
    maps: ['main'],
  },

  'packages/public-ui': {
    purpose: 'UI-компоненты для витрины (storefront): SfButton, SfBottomSheet, SfDishCard и т.д.',
    sources: [{ dir: 'src' }],
    assign: () => 'main',
    maps: ['main'],
  },

  'packages/kit': {
    purpose: 'Общий рантайм-кит для storefront/public-ui: брейкпоинты, модалки, query/mutation, валидация форм, layer-стек, цветовые токены',
    sources: [{ dir: 'src' }],
    assign: () => 'main',
    maps: ['main'],
  },

  'packages/icons': {
    purpose: 'SVG-иконки как Vue-компоненты (UiIcon + реестр Lucide)',
    sources: [{ dir: 'src' }],
    assign: () => 'main',
    maps: ['main'],
  },
};

// ============================================================
// SCSS-карты проектов
// Отдельный реестр от PROJECTS — стили живут в своих папках,
// кто-то из «обычных» проектов может вообще не иметь SCSS,
// и наоборот packages/styles — только стили.
// ============================================================

export const STYLE_PROJECTS = {
  'packages/styles': {
    label: 'Глобальные токены и миксины монорепо. Используются всеми приложениями и пакетами через @use \'@fastio/styles/...\'.',
    sources: [
      { dir: 'variables' },
      { dir: 'mixins' },
    ],
    output: '.claude/codemap/packages/styles.styles.md',
  },
  'apps/admin': {
    label: 'Локальные стили админки (помимо @fastio/styles).',
    sources: [{ dir: 'assets/css' }],
    output: '.claude/codemap/apps/admin.styles.md',
  },
  'apps/storefront': {
    label: 'Локальные стили витрины (помимо @fastio/styles).',
    sources: [{ dir: 'assets/styles' }],
    output: '.claude/codemap/apps/storefront.styles.md',
  },
  'apps/help': {
    label: 'Локальные стили базы знаний.',
    sources: [{ dir: 'assets' }],
    output: '.claude/codemap/apps/help.styles.md',
  },
  'apps/landing': {
    label: 'Локальные стили лендинга.',
    sources: [{ dir: 'assets/styles' }],
    output: '.claude/codemap/apps/landing.styles.md',
  },
  'packages/public-ui': {
    label: 'Локальные миксины пакета public-ui (для компонентов витрины).',
    sources: [{ dir: 'src/styles' }],
    output: '.claude/codemap/packages/public-ui.styles.md',
  },
};

// Принадлежность .scss файла → ключу STYLE_PROJECTS (по префиксу пути)
export function getStyleProjectForFile(relPath) {
  const keys = Object.keys(STYLE_PROJECTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (relPath === key || relPath.startsWith(key + '/')) return key;
  }
  return null;
}

// под-карта одного проекта → путь к файлу
export function mapPath(projectKey, subMap) {
  const cfg = PROJECTS[projectKey];
  if (!cfg) throw new Error(`Unknown project: ${projectKey}`);
  if (cfg.maps.length === 1 && cfg.maps[0] === 'main') {
    return `.claude/codemap/${projectKey}.json`;
  }
  return `.claude/codemap/${projectKey}/${subMap}.json`;
}

// Принадлежность файла → проекту (по префиксу пути относительно корня монорепо)
export function getProjectForFile(relPath) {
  const keys = Object.keys(PROJECTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (relPath === key || relPath.startsWith(key + '/')) return key;
  }
  return null;
}
